import {
    CredentialChangeReason,
    InvalidCredentialsError,
    NotFoundError,
    SessionRevocationReason,
    ValidationError,
    type IPasswordHasher,
    type ISessionRepository,
    type IUnitOfWork,
} from "../../../domain";

export interface ChangePasswordInput {
    currentPassword: string;
    newPassword: string;
}

export interface ChangePasswordDependencies {
    passwordHasher: IPasswordHasher;
    sessionRepository: ISessionRepository;
    unitOfWork: IUnitOfWork;
    passwordMinLength: number;
}

/**
 * Self-service password change for an authenticated user.
 *
 * Changing a password revokes every other session. Leaving old sessions alive
 * means a user who changed their password *because* they suspected compromise
 * has not actually locked the attacker out.
 */
export class ChangePasswordUseCase {
    constructor(private readonly deps: ChangePasswordDependencies) {}

    async execute(userId: string, input: ChangePasswordInput): Promise<void> {
        this.assertPasswordPolicy(input.newPassword);

        await this.deps.unitOfWork.run(async (repositories) => {
            const user = await repositories.users.findById(userId);
            if (!user) throw new NotFoundError("User", userId);

            const currentMatches = await this.deps.passwordHasher.compare(
                input.currentPassword,
                user.passwordHash,
            );
            if (!currentMatches) throw new InvalidCredentialsError("Current password is incorrect");

            const isSamePassword = await this.deps.passwordHasher.compare(
                input.newPassword,
                user.passwordHash,
            );
            if (isSamePassword) {
                throw ValidationError.forField(
                    "newPassword",
                    "New password must be different from the current one",
                );
            }

            const newHash = await this.deps.passwordHasher.hash(input.newPassword);
            user.changePassword(newHash, CredentialChangeReason.Password);
            await repositories.users.update(user);

            await repositories.sessions.revokeAllForUser(
                userId,
                SessionRevocationReason.CREDENTIALS_CHANGED,
            );
        });
    }

    private assertPasswordPolicy(password: string): void {
        const issues: string[] = [];
        if (password.length < this.deps.passwordMinLength) {
            issues.push(`be at least ${this.deps.passwordMinLength} characters`);
        }
        if (!/[a-z]/.test(password)) issues.push("contain a lowercase letter");
        if (!/[A-Z]/.test(password)) issues.push("contain an uppercase letter");
        if (!/\d/.test(password)) issues.push("contain a digit");

        if (issues.length > 0) {
            throw ValidationError.forField("newPassword", `Password must ${issues.join(", ")}`);
        }
    }
}
