import type { Session } from "../generated/client";
import { SessionEntity } from "../../../domain/entities";

export function toSessionEntity(row: Session): SessionEntity {
    return SessionEntity.rehydrate({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        refreshTokenHash: row.refreshTokenHash,
        familyId: row.familyId,
        userAgent: row.userAgent,
        ipAddress: row.ipAddress,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        revokedReason: row.revokedReason,
        createdAt: row.createdAt,
    });
}

export function toSessionCreateData(entity: SessionEntity) {
    const p = entity.toPrimitives();
    return {
        tenantId: p.tenantId,
        userId: p.userId,
        refreshTokenHash: p.refreshTokenHash,
        familyId: p.familyId,
        userAgent: p.userAgent,
        ipAddress: p.ipAddress,
        expiresAt: p.expiresAt,
    };
}
