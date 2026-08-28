import type { SessionEntity, SessionRevocationReasonValue } from "../entities";

export interface ISessionRepository {
    create(session: SessionEntity): Promise<SessionEntity>;

    /**
     * Cross-tenant by necessity: a refresh token is presented without an
     * access token, so the tenant is unknown until the session is found.
     */
    findByRefreshTokenHash(tokenHash: string): Promise<SessionEntity | null>;

    findActiveByUserId(userId: string): Promise<SessionEntity[]>;

    revoke(sessionId: string, reason: SessionRevocationReasonValue): Promise<void>;

    /** Reuse detection: kills every rotation descended from one login. */
    revokeFamily(familyId: string, reason: SessionRevocationReasonValue): Promise<number>;

    revokeAllForUser(userId: string, reason: SessionRevocationReasonValue): Promise<number>;

    /** Housekeeping for a scheduled job. Returns rows removed. */
    deleteExpiredBefore(cutoff: Date): Promise<number>;
}
