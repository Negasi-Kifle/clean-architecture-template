import {
    PasswordResetTokenEntity,
    type IEmailSender,
    type IIdentityRepository,
    type IPasswordResetTokenRepository,
    type ISecureRandom,
} from "../../../domain";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";
import { logger } from "../../../shared/logger";

export interface RequestPasswordResetInput {
    email: string;
}

export interface RequestPasswordResetDependencies {
    identityRepository: IIdentityRepository;
    passwordResetTokenRepository: IPasswordResetTokenRepository;
    secureRandom: ISecureRandom;
    emailSender: IEmailSender;
    clientUrl: string;
    ttlSeconds: number;
}

/**
 * Issues a single-use reset grant and emails the link.
 *
 * Always resolves successfully, whatever happens internally. An unknown email,
 * an SMTP outage and a happy path are indistinguishable to the caller — if
 * they were not, this endpoint would tell anyone which addresses have
 * accounts. Failures are logged, never surfaced.
 */
export class RequestPasswordResetUseCase {
    constructor(private readonly deps: RequestPasswordResetDependencies) {}

    async execute(input: RequestPasswordResetInput): Promise<void> {
        const email = input.email.trim().toLowerCase();

        const user = await runCrossTenant(() => this.deps.identityRepository.findByEmail(email));
        if (!user || !user.canAuthenticate()) {
            logger.debug({ email }, "Password reset requested for unknown or inactive account");
            return;
        }

        const rawToken = this.deps.secureRandom.opaqueToken(32);
        const expiresAt = new Date(Date.now() + this.deps.ttlSeconds * 1000);

        try {
            await runWithTenant(user.tenantId, async () => {
                // Issuing a new grant invalidates any outstanding one, so a
                // forwarded old email cannot be replayed later.
                await this.deps.passwordResetTokenRepository.invalidateAllForUser(user.id);
                await this.deps.passwordResetTokenRepository.create(
                    PasswordResetTokenEntity.create({
                        tenantId: user.tenantId,
                        userId: user.id,
                        tokenHash: this.deps.secureRandom.sha256(rawToken),
                        expiresAt,
                    }),
                );
            });

            await this.deps.emailSender.sendPasswordReset({
                to: user.email,
                recipientName: user.firstName,
                resetUrl: `${this.deps.clientUrl}/reset-password?token=${encodeURIComponent(rawToken)}`,
                expiresInMinutes: Math.round(this.deps.ttlSeconds / 60),
            });
        } catch (error) {
            logger.error({ err: error, userId: user.id }, "Failed to issue password reset");
        }
    }
}
