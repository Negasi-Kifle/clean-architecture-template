import type { UserEntity } from "../../../domain/entities";
import type { IIdentityRepository } from "../../../domain/repositories";
import { PrismaBaseRepository } from "./base.repository";
import { toUserEntity } from "../mappers";
import { normalizeEmail, normalizePhone } from "../../../domain/validation";

/**
 * The cross-tenant identity lookups.
 *
 * Everything here bypasses tenant scoping BY DESIGN, because the tenant is
 * what these queries resolve. Callers must wrap them in `runCrossTenant()` —
 * the Prisma extension throws otherwise, so a caller that forgets fails
 * immediately rather than reading nothing and looking like a wrong password.
 *
 * Keep this file small. Every method added here is another query that can see
 * every tenant's data, and this is the file a security review reads first.
 */
export class IdentityRepository extends PrismaBaseRepository implements IIdentityRepository {
    async findByEmailOrPhone(identifier: string): Promise<UserEntity | null> {
        const trimmed = identifier.trim();
        if (!trimmed) return null;

        const row = await this.db.user.findFirst({
            where: {
                deletedAt: null,
                OR: [{ email: normalizeEmail(trimmed) }, { phoneNumber: normalizePhone(trimmed) }],
            },
        });
        return row ? toUserEntity(row) : null;
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const row = await this.db.user.findFirst({
            where: { email: normalizeEmail(email), deletedAt: null },
        });
        return row ? toUserEntity(row) : null;
    }

    async findById(id: string): Promise<UserEntity | null> {
        const row = await this.db.user.findFirst({ where: { id, deletedAt: null } });
        return row ? toUserEntity(row) : null;
    }
}
