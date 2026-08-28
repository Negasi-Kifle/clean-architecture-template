import {
    AccountInactiveError,
    InvalidRefreshTokenError,
    RefreshTokenReuseDetectedError,
    SessionEntity,
    SessionRevocationReason,
    type IIdentityRepository,
    type ISecureRandom,
    type ISessionRepository,
    type ITokenService,
    type IUnitOfWork,
} from "../../../domain";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";
import { logger } from "../../../shared/logger";

export interface RefreshTokenInput {
    refreshToken: string;
    userAgent?: string;
    ipAddress?: string;
}

export interface RefreshTokenResult {
    accessToken: string;
    /** A NEW refresh token. The presented one is dead the moment this returns. */
    refreshToken: string;
    expiresInSeconds: number;
}

export interface RefreshTokenDependencies {
    sessionRepository: ISessionRepository;
    identityRepository: IIdentityRepository;
    tokenService: ITokenService;
    secureRandom: ISecureRandom;
    unitOfWork: IUnitOfWork;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
}

/**
 * Rotating refresh with reuse detection.
 *
 * Every refresh mints a new token and revokes the presented one. If a token
 * that was ALREADY rotated is presented again, exactly one thing can be true:
 * two parties hold tokens from the same login, i.e. one of them stole it.
 * There is no way to tell which is the legitimate client, so the entire family
 * is revoked and both are forced to sign in again.
 *
 * Without rotation, a stolen refresh token is silently valid for its full
 * lifetime and there is no signal that anything happened.
 */
export class RefreshTokenUseCase {
    constructor(private readonly deps: RefreshTokenDependencies) {}

    async execute(input: RefreshTokenInput): Promise<RefreshTokenResult> {
        const tokenHash = this.deps.secureRandom.sha256(input.refreshToken.trim());

        const session = await runCrossTenant(() =>
            this.deps.sessionRepository.findByRefreshTokenHash(tokenHash),
        );
        if (!session) {
            throw new InvalidRefreshTokenError();
        }

        if (session.isRevoked) {
            await this.handleReuse(session);
        }

        if (session.isExpired) {
            await runWithTenant(session.tenantId, () =>
                this.deps.sessionRepository.revoke(session.id, SessionRevocationReason.ROTATED),
            );
            throw new InvalidRefreshTokenError();
        }

        const user = await runCrossTenant(() =>
            this.deps.identityRepository.findById(session.userId),
        );
        if (!user || !user.canAuthenticate()) {
            await runWithTenant(session.tenantId, () =>
                this.deps.sessionRepository.revokeFamily(
                    session.familyId,
                    SessionRevocationReason.CREDENTIALS_CHANGED,
                ),
            );
            throw new AccountInactiveError();
        }

        const newRefreshToken = this.deps.secureRandom.opaqueToken();

        // Revoke-then-issue must be atomic. A crash between the two would
        // otherwise leave the user with no usable refresh token at all.
        await runWithTenant(session.tenantId, () =>
            this.deps.unitOfWork.run(async (repositories) => {
                await repositories.sessions.revoke(session.id, SessionRevocationReason.ROTATED);
                await repositories.sessions.create(
                    SessionEntity.create({
                        tenantId: session.tenantId,
                        userId: session.userId,
                        refreshTokenHash: this.deps.secureRandom.sha256(newRefreshToken),
                        familyId: session.familyId,
                        userAgent: input.userAgent ?? session.userAgent,
                        ipAddress: input.ipAddress ?? session.ipAddress,
                        expiresAt: new Date(Date.now() + this.deps.refreshTokenTtlSeconds * 1000),
                    }),
                );
            }),
        );

        const accessToken = await this.deps.tokenService.signAccessToken({
            sub: user.id,
            tenantId: user.tenantId,
            roles: [...user.roles],
            credentialsVersion: user.credentialsVersion,
        });

        return {
            accessToken,
            refreshToken: newRefreshToken,
            expiresInSeconds: this.deps.accessTokenTtlSeconds,
        };
    }

    private async handleReuse(session: SessionEntity): Promise<never> {
        const revokedCount = await runWithTenant(session.tenantId, () =>
            this.deps.sessionRepository.revokeFamily(
                session.familyId,
                SessionRevocationReason.REUSE_DETECTED,
            ),
        );

        logger.warn(
            {
                event: "refresh_token_reuse_detected",
                userId: session.userId,
                tenantId: session.tenantId,
                familyId: session.familyId,
                sessionsRevoked: revokedCount,
            },
            "Refresh token reuse detected; revoked the entire session family",
        );

        throw new RefreshTokenReuseDetectedError();
    }
}
