import {
    CredentialChangeReason,
    SessionRevocationReason,
    ValidationError,
    type IPasswordHasher,
    type IPasswordResetTokenRepository,
    type ISecureRandom,
    type IUnitOfWork,
} from "../../../domain";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";

export interface ResetPasswordInput {
    token: string;
    newPassword: string;
}

export interface ResetPasswordDependencies {
    passwordResetTokenRepository: IPasswordResetTokenRepository;
    passwordHasher: IPasswordHasher;
    secureRandom: ISecureRandom;
    unitOfWork: IUnitOfWork;
    passwordMinLength: number;
}

export class ResetPasswordUseCase {
    constructor(private readonly deps: ResetPasswordDependencies) {}

    async execute(input: ResetPasswordInput): Promise<void> {
        if (input.newPassword.length < this.deps.passwordMinLength) {
            throw ValidationError.forField(
                "newPassword",
                `Password must be at least ${this.deps.passwordMinLength} characters`,
            );
        }

        const tokenHash = this.deps.secureRandom.sha256(input.token.trim());
        const grant = await runCrossTenant(() =>
            this.deps.passwordResetTokenRepository.findByTokenHash(tokenHash),
        );

        // One message for "no such token", "already used" and "expired". Three
        // distinct messages would let someone probe which tokens ever existed.
        if (!grant || !grant.isUsable) {
            throw new ValidationError("This reset link is invalid or has expired", [
                { field: "token", message: "Invalid or expired reset link" },
            ]);
        }

        const newHash = await this.deps.passwordHasher.hash(input.newPassword);

        await runWithTenant(grant.tenantId, () =>
            this.deps.unitOfWork.run(async (repositories) => {
                const user = await repositories.users.findById(grant.userId);
                if (!user) {
                    throw new ValidationError("This reset link is invalid or has expired", [
                        { field: "token", message: "Invalid or expired reset link" },
                    ]);
                }

                user.changePassword(newHash, CredentialChangeReason.Password);
                await repositories.users.update(user);

                await repositories.passwordResetTokens.markUsed(grant.id);
                await repositories.sessions.revokeAllForUser(
                    user.id,
                    SessionRevocationReason.CREDENTIALS_CHANGED,
                );
            }),
        );
    }
}
