import type { IPasswordResetTokenRepository, ISecureRandom } from "../../../domain";
import { runCrossTenant } from "../../../shared/request-context";

/**
 * Lets the reset page tell the user their link is stale BEFORE they type a new
 * password twice. Returns a boolean rather than throwing, because "expired" is
 * an expected answer here, not an error.
 */
export class VerifyResetTokenUseCase {
    constructor(
        private readonly passwordResetTokenRepository: IPasswordResetTokenRepository,
        private readonly secureRandom: ISecureRandom,
    ) {}

    async execute(token: string): Promise<{ valid: boolean }> {
        const tokenHash = this.secureRandom.sha256(token.trim());
        const grant = await runCrossTenant(() =>
            this.passwordResetTokenRepository.findByTokenHash(tokenHash),
        );
        return { valid: Boolean(grant?.isUsable) };
    }
}
