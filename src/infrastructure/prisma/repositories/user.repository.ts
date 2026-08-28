import type { UserEntity } from "../../../domain/entities";
import type { UserRole } from "../../../domain/enums";
import type { IUserRepository, UserFilters, UserSortField } from "../../../domain/repositories";
import type { QueryOptions } from "../../../domain/interfaces";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import { toUserCreateData, toUserEntity, toUserUpdateData } from "../mappers";
import { buildOrderBy, buildUserWhere } from "../where-clauses";

export class UserRepository extends PrismaBaseRepository implements IUserRepository {
    async findById(id: string): Promise<UserEntity | null> {
        const row = await this.db.user.findFirst({ where: { id, deletedAt: null } });
        return row ? toUserEntity(row) : null;
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        const row = await this.db.user.findFirst({
            where: { email: email.trim().toLowerCase(), deletedAt: null },
        });
        return row ? toUserEntity(row) : null;
    }

    async findMany(options: QueryOptions<UserFilters, UserSortField>): Promise<UserEntity[]> {
        const rows = await this.db.user.findMany({
            where: buildUserWhere(options.filters),
            orderBy: buildOrderBy(options.sort),
            skip: options.pagination.skip,
            take: options.pagination.take,
        });
        return rows.map(toUserEntity);
    }

    async count(filters: UserFilters): Promise<number> {
        return this.db.user.count({ where: buildUserWhere(filters) });
    }

    async exists(filters: UserFilters): Promise<boolean> {
        const row = await this.db.user.findFirst({
            where: buildUserWhere(filters),
            select: { id: true },
        });
        return row !== null;
    }

    /**
     * One query, two answers.
     *
     * Doing this as two separate lookups (as the reference implementation did)
     * costs a second round trip and, more importantly, cannot distinguish which
     * of the two collided — so the API reports "email already taken" when it
     * was actually the phone number.
     *
     * Soft-deleted rows still occupy the unique index, so they are counted as
     * taken here. Otherwise the create would pass this check and then fail on
     * the database constraint.
     */
    async existsByEmailOrPhone(
        email: string | undefined,
        phoneNumber: string | undefined,
        excludeUserId?: string,
    ): Promise<{ emailTaken: boolean; phoneTaken: boolean }> {
        const or: Array<{ email?: string; phoneNumber?: string }> = [];
        if (email) or.push({ email: email.trim().toLowerCase() });
        if (phoneNumber) or.push({ phoneNumber });
        if (or.length === 0) return { emailTaken: false, phoneTaken: false };

        const rows = await this.db.user.findMany({
            where: {
                OR: or,
                ...(excludeUserId && { id: { not: excludeUserId } }),
            },
            select: { email: true, phoneNumber: true },
        });

        const normalizedEmail = email?.trim().toLowerCase();
        return {
            emailTaken: Boolean(normalizedEmail) && rows.some((r) => r.email === normalizedEmail),
            phoneTaken: Boolean(phoneNumber) && rows.some((r) => r.phoneNumber === phoneNumber),
        };
    }

    async countByRole(role: UserRole): Promise<number> {
        return this.db.user.count({
            where: { roles: { has: role }, isActive: true, deletedAt: null },
        });
    }

    async create(entity: UserEntity): Promise<UserEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.user.create({ data: toUserCreateData(entity) });
            return toUserEntity(row);
        });
    }

    async update(entity: UserEntity): Promise<UserEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.user.update({
                where: { id: entity.id },
                data: toUserUpdateData(entity),
            });
            return toUserEntity(row);
        });
    }

    async softDelete(id: string): Promise<void> {
        await mapPrismaErrors(() =>
            this.db.user.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false, credentialsChangedAt: new Date() },
            }),
        );
    }

    async hardDelete(id: string): Promise<void> {
        await mapPrismaErrors(() => this.db.user.delete({ where: { id } }));
    }
}
