import {
    AccountInactiveError,
    InvalidCredentialsError,
    SessionEntity,
    type IIdentityRepository,
    type IPasswordHasher,
    type ISecureRandom,
    type ISessionRepository,
    type ITenantRepository,
    type ITokenService,
    type IUserRepository,
    type UserEntity,
    type UserRole,
} from "../../../domain";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";

export interface LoginInput {
    /** Email or phone number. */
    identifier: string;
    password: string;
    userAgent?: string;
    ipAddress?: string;
}

export interface LoginResult {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
    mustChangePassword: boolean;
    user: {
        id: string;
        tenantId: string;
        firstName: string;
        lastName: string;
        email: string;
        roles: readonly UserRole[];
    };
}

export interface LoginDependencies {
    identityRepository: IIdentityRepository;
    tenantRepository: ITenantRepository;
    sessionRepository: ISessionRepository;
    userRepository: IUserRepository;
    passwordHasher: IPasswordHasher;
    tokenService: ITokenService;
    secureRandom: ISecureRandom;
    accessTokenTtlSeconds: number;
    refreshTokenTtlSeconds: number;
}

/**
 * A bcrypt hash of a value nobody knows.
 *
 * When the identifier does not exist we still run a comparison against this,
 * so a request for an unknown account costs the same wall-clock time as one
 * for a known account. Skipping it turns the login endpoint into a user
 * enumeration oracle measurable over the network.
 */
const TIMING_EQUALIZER_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.Nq2c8VqZWJ1lQ8bXqB9nQmJZ0K1rF9y";

export class LoginUseCase {
    constructor(private readonly deps: LoginDependencies) {}

    async execute(input: LoginInput): Promise<LoginResult> {
        const identifier = input.identifier.trim().toLowerCase();

        // Login is one of the few operations that legitimately spans tenants:
        // the tenant is an OUTPUT of resolving the identifier, not an input.
        const user = await runCrossTenant(() =>
            this.deps.identityRepository.findByEmailOrPhone(identifier),
        );

        if (!user) {
            await this.deps.passwordHasher.compare(input.password, TIMING_EQUALIZER_HASH);
            throw new InvalidCredentialsError();
        }

        const passwordMatches = await this.deps.passwordHasher.compare(
            input.password,
            user.passwordHash,
        );
        if (!passwordMatches) {
            throw new InvalidCredentialsError();
        }

        // Account-state errors are raised only AFTER the password checks out.
        // Reporting "this account is disabled" to someone who did not supply
        // the right password confirms the account exists.
        if (!user.canAuthenticate()) {
            throw new AccountInactiveError();
        }

        const tenant = await runCrossTenant(() =>
            this.deps.tenantRepository.findById(user.tenantId),
        );
        if (!tenant || !tenant.isActive || tenant.isDeleted) {
            throw new AccountInactiveError("This workspace is no longer active");
        }

        return runWithTenant(user.tenantId, async () => {
            const { accessToken, refreshToken } = await this.issueSession(user, input);

            user.recordLogin();
            await this.deps.userRepository.update(user);

            return {
                accessToken,
                refreshToken,
                expiresInSeconds: this.deps.accessTokenTtlSeconds,
                mustChangePassword: user.mustChangePassword,
                user: {
                    id: user.id,
                    tenantId: user.tenantId,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    roles: user.roles,
                },
            };
        });
    }

    private async issueSession(
        user: UserEntity,
        input: LoginInput,
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const refreshToken = this.deps.secureRandom.opaqueToken();

        await this.deps.sessionRepository.create(
            SessionEntity.create({
                tenantId: user.tenantId,
                userId: user.id,
                refreshTokenHash: this.deps.secureRandom.sha256(refreshToken),
                // A fresh family per login: revoking one compromised session
                // must not sign the user out of their other devices.
                familyId: this.deps.secureRandom.uuid(),
                userAgent: input.userAgent ?? null,
                ipAddress: input.ipAddress ?? null,
                expiresAt: new Date(Date.now() + this.deps.refreshTokenTtlSeconds * 1000),
            }),
        );

        const accessToken = await this.deps.tokenService.signAccessToken({
            sub: user.id,
            tenantId: user.tenantId,
            roles: [...user.roles],
            credentialsVersion: user.credentialsVersion,
        });

        return { accessToken, refreshToken };
    }
}
