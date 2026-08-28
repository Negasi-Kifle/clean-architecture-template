import type { SessionEntity, SessionRevocationReasonValue } from "../../../domain/entities";
import type { ISessionRepository } from "../../../domain/repositories";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import { toSessionCreateData, toSessionEntity } from "../mappers";

export class SessionRepository extends PrismaBaseRepository implements ISessionRepository {
    async create(session: SessionEntity): Promise<SessionEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.session.create({ data: toSessionCreateData(session) });
            return toSessionEntity(row);
        });
    }

    /**
     * Deliberately returns revoked and expired sessions too.
     *
     * The refresh use case needs to distinguish "no such token" from "a token
     * that was already rotated" — the second is the reuse signal. Filtering
     * revoked rows out here would throw that signal away and make a stolen
     * token indistinguishable from a typo.
     */
    async findByRefreshTokenHash(tokenHash: string): Promise<SessionEntity | null> {
        const row = await this.db.session.findUnique({ where: { refreshTokenHash: tokenHash } });
        return row ? toSessionEntity(row) : null;
    }

    async findActiveByUserId(userId: string): Promise<SessionEntity[]> {
        const rows = await this.db.session.findMany({
            where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map(toSessionEntity);
    }

    async revoke(sessionId: string, reason: SessionRevocationReasonValue): Promise<void> {
        await this.db.session.updateMany({
            where: { id: sessionId, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: reason },
        });
    }

    async revokeFamily(familyId: string, reason: SessionRevocationReasonValue): Promise<number> {
        const result = await this.db.session.updateMany({
            where: { familyId, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: reason },
        });
        return result.count;
    }

    async revokeAllForUser(userId: string, reason: SessionRevocationReasonValue): Promise<number> {
        const result = await this.db.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date(), revokedReason: reason },
        });
        return result.count;
    }

    async deleteExpiredBefore(cutoff: Date): Promise<number> {
        const result = await this.db.session.deleteMany({ where: { expiresAt: { lt: cutoff } } });
        return result.count;
    }
}
