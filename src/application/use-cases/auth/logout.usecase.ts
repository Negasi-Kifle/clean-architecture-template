import {
    SessionRevocationReason,
    type ISecureRandom,
    type ISessionRepository,
} from "../../../domain";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";

export interface LogoutInput {
    refreshToken: string;
}

/**
 * Revokes the presented session only.
 *
 * Returns silently for an unknown token: logging out is idempotent, and an
 * error here would tell a caller whether a token they hold is real.
 */
export class LogoutUseCase {
    constructor(
        private readonly sessionRepository: ISessionRepository,
        private readonly secureRandom: ISecureRandom,
    ) {}

    async execute(input: LogoutInput): Promise<void> {
        const tokenHash = this.secureRandom.sha256(input.refreshToken.trim());
        const session = await runCrossTenant(() =>
            this.sessionRepository.findByRefreshTokenHash(tokenHash),
        );
        if (!session || session.isRevoked) return;

        await runWithTenant(session.tenantId, () =>
            this.sessionRepository.revoke(session.id, SessionRevocationReason.LOGOUT),
        );
    }
}

/** Signs the user out of every device. */
export class LogoutAllUseCase {
    constructor(private readonly sessionRepository: ISessionRepository) {}

    async execute(userId: string): Promise<{ sessionsRevoked: number }> {
        const sessionsRevoked = await this.sessionRepository.revokeAllForUser(
            userId,
            SessionRevocationReason.LOGOUT_ALL,
        );
        return { sessionsRevoked };
    }
}
