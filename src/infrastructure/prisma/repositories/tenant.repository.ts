import type { TenantEntity } from "../../../domain/entities";
import type {
    ITenantRepository,
    TenantFilters,
    TenantSortField,
} from "../../../domain/repositories";
import type { QueryOptions } from "../../../domain/interfaces";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import { toTenantCreateData, toTenantEntity, toTenantUpdateData } from "../mappers";
import { buildOrderBy, buildTenantWhere } from "../where-clauses";

export class TenantRepository extends PrismaBaseRepository implements ITenantRepository {
    async findById(id: string): Promise<TenantEntity | null> {
        const row = await this.db.tenant.findFirst({ where: { id, deletedAt: null } });
        return row ? toTenantEntity(row) : null;
    }

    async findBySlug(slug: string): Promise<TenantEntity | null> {
        const row = await this.db.tenant.findFirst({
            where: { slug: slug.trim().toLowerCase(), deletedAt: null },
        });
        return row ? toTenantEntity(row) : null;
    }

    async findMany(options: QueryOptions<TenantFilters, TenantSortField>): Promise<TenantEntity[]> {
        const rows = await this.db.tenant.findMany({
            where: buildTenantWhere(options.filters),
            orderBy: buildOrderBy(options.sort),
            skip: options.pagination.skip,
            take: options.pagination.take,
        });
        return rows.map(toTenantEntity);
    }

    async count(filters: TenantFilters): Promise<number> {
        return this.db.tenant.count({ where: buildTenantWhere(filters) });
    }

    async exists(filters: TenantFilters): Promise<boolean> {
        const row = await this.db.tenant.findFirst({
            where: buildTenantWhere(filters),
            select: { id: true },
        });
        return row !== null;
    }

    async create(entity: TenantEntity): Promise<TenantEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.tenant.create({ data: toTenantCreateData(entity) });
            return toTenantEntity(row);
        });
    }

    async update(entity: TenantEntity): Promise<TenantEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.tenant.update({
                where: { id: entity.id },
                data: toTenantUpdateData(entity),
            });
            return toTenantEntity(row);
        });
    }

    async softDelete(id: string): Promise<void> {
        await mapPrismaErrors(() =>
            this.db.tenant.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false },
            }),
        );
    }

    async hardDelete(id: string): Promise<void> {
        await mapPrismaErrors(() => this.db.tenant.delete({ where: { id } }));
    }
}
