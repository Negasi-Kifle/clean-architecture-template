import type { BranchEntity } from "../../../domain/entities";
import type {
    BranchFilters,
    BranchSortField,
    IBranchRepository,
} from "../../../domain/repositories";
import type { QueryOptions } from "../../../domain/interfaces";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import { toBranchCreateData, toBranchEntity, toBranchUpdateData } from "../mappers";
import { buildBranchWhere, buildOrderBy } from "../where-clauses";

export class BranchRepository extends PrismaBaseRepository implements IBranchRepository {
    async findById(id: string): Promise<BranchEntity | null> {
        const row = await this.db.branch.findFirst({ where: { id, deletedAt: null } });
        return row ? toBranchEntity(row) : null;
    }

    async findByCode(code: string): Promise<BranchEntity | null> {
        const row = await this.db.branch.findFirst({
            where: { code: code.trim().toUpperCase(), deletedAt: null },
        });
        return row ? toBranchEntity(row) : null;
    }

    async findMany(options: QueryOptions<BranchFilters, BranchSortField>): Promise<BranchEntity[]> {
        const rows = await this.db.branch.findMany({
            where: buildBranchWhere(options.filters),
            orderBy: buildOrderBy(options.sort, { name: "asc" }),
            skip: options.pagination.skip,
            take: options.pagination.take,
        });
        return rows.map(toBranchEntity);
    }

    async count(filters: BranchFilters): Promise<number> {
        return this.db.branch.count({ where: buildBranchWhere(filters) });
    }

    async exists(filters: BranchFilters): Promise<boolean> {
        const row = await this.db.branch.findFirst({
            where: buildBranchWhere(filters),
            select: { id: true },
        });
        return row !== null;
    }

    async countEmployees(branchId: string): Promise<number> {
        return this.db.employee.count({ where: { branchId, deletedAt: null } });
    }

    async create(entity: BranchEntity): Promise<BranchEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.branch.create({ data: toBranchCreateData(entity) });
            return toBranchEntity(row);
        });
    }

    async update(entity: BranchEntity): Promise<BranchEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.branch.update({
                where: { id: entity.id },
                data: toBranchUpdateData(entity),
            });
            return toBranchEntity(row);
        });
    }

    async softDelete(id: string): Promise<void> {
        await mapPrismaErrors(() =>
            this.db.branch.update({
                where: { id },
                data: { deletedAt: new Date(), isActive: false },
            }),
        );
    }

    async hardDelete(id: string): Promise<void> {
        await mapPrismaErrors(() => this.db.branch.delete({ where: { id } }));
    }
}
