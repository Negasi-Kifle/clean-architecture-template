import type { PasswordResetToken } from "../generated/client";
import { PasswordResetTokenEntity } from "../../../domain/entities";

export function toPasswordResetTokenEntity(row: PasswordResetToken): PasswordResetTokenEntity {
    return PasswordResetTokenEntity.rehydrate({
        id: row.id,
        tenantId: row.tenantId,
        userId: row.userId,
        tokenHash: row.tokenHash,
        expiresAt: row.expiresAt,
        usedAt: row.usedAt,
        createdAt: row.createdAt,
    });
}

export function toPasswordResetTokenCreateData(entity: PasswordResetTokenEntity) {
    const p = entity.toPrimitives();
    return {
        tenantId: p.tenantId,
        userId: p.userId,
        tokenHash: p.tokenHash,
        expiresAt: p.expiresAt,
    };
}
