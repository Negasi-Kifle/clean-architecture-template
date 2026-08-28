import type { PasswordResetTokenEntity } from "../../../domain/entities";
import type { IPasswordResetTokenRepository } from "../../../domain/repositories";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import { toPasswordResetTokenCreateData, toPasswordResetTokenEntity } from "../mappers";

export class PasswordResetTokenRepository
    extends PrismaBaseRepository
    implements IPasswordResetTokenRepository
{
    async create(token: PasswordResetTokenEntity): Promise<PasswordResetTokenEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.passwordResetToken.create({
                data: toPasswordResetTokenCreateData(token),
            });
            return toPasswordResetTokenEntity(row);
        });
    }

    async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
        const row = await this.db.passwordResetToken.findUnique({ where: { tokenHash } });
        return row ? toPasswordResetTokenEntity(row) : null;
    }

    async markUsed(id: string): Promise<void> {
        await this.db.passwordResetToken.updateMany({
            where: { id, usedAt: null },
            data: { usedAt: new Date() },
        });
    }

    async invalidateAllForUser(userId: string): Promise<number> {
        const result = await this.db.passwordResetToken.updateMany({
            where: { userId, usedAt: null },
            data: { usedAt: new Date() },
        });
        return result.count;
    }
}
