import type { SessionEntity } from "../../../domain/entities";

/**
 * What a user sees in "active sessions".
 *
 * The refresh-token hash is absent. It is not secret in the sense a password
 * is, but showing it serves no purpose and widens what a leaked response body
 * is worth.
 */
export interface SessionResponse {
    id: string;
    userAgent: string | null;
    ipAddress: string | null;
    createdAt: string;
    expiresAt: string;
}

export function toSessionResponse(session: SessionEntity): SessionResponse {
    return {
        id: session.id,
        userAgent: session.userAgent,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt.toISOString(),
        expiresAt: session.expiresAt.toISOString(),
    };
}
