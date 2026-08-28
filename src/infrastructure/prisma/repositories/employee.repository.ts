import type { EmployeeEntity } from "../../../domain/entities";
import type {
    EmployeeFilters,
    EmployeeSortField,
    IEmployeeRepository,
} from "../../../domain/repositories";
import type { QueryOptions } from "../../../domain/interfaces";
import { PrismaBaseRepository } from "./base.repository";
import { mapPrismaErrors } from "../exceptions";
import {
    branchSummarySelect,
    toEmployeeCreateData,
    toEmployeeEntity,
    toEmployeeUpdateData,
    userSummarySelect,
} from "../mappers";
import { buildEmployeeWhere, buildOrderBy } from "../where-clauses";

/** What list rows need. Never the password hash. */
const listInclude = {
    user: { select: userSummarySelect },
    branch: { select: branchSummarySelect },
} as const;

export class EmployeeRepository extends PrismaBaseRepository implements IEmployeeRepository {
    async findById(id: string): Promise<EmployeeEntity | null> {
        const row = await this.db.employee.findFirst({ where: { id, deletedAt: null } });
        return row ? toEmployeeEntity(row) : null;
    }

    /** Detail read. Separate from `findById` so writes are not forced to join. */
    async findDetailById(id: string): Promise<EmployeeEntity | null> {
        const row = await this.db.employee.findFirst({
            where: { id, deletedAt: null },
            include: listInclude,
        });
        return row ? toEmployeeEntity(row) : null;
    }

    async findByUserId(userId: string): Promise<EmployeeEntity | null> {
        const row = await this.db.employee.findFirst({ where: { userId, deletedAt: null } });
        return row ? toEmployeeEntity(row) : null;
    }

    async findByEmployeeNumber(employeeNumber: string): Promise<EmployeeEntity | null> {
        const row = await this.db.employee.findFirst({
            where: { employeeNumber: employeeNumber.trim(), deletedAt: null },
        });
        return row ? toEmployeeEntity(row) : null;
    }

    async findMany(
        options: QueryOptions<EmployeeFilters, EmployeeSortField>,
    ): Promise<EmployeeEntity[]> {
        const rows = await this.db.employee.findMany({
            where: buildEmployeeWhere(options.filters),
            orderBy: buildOrderBy(options.sort),
            skip: options.pagination.skip,
            take: options.pagination.take,
            include: listInclude,
        });
        return rows.map(toEmployeeEntity);
    }

    async count(filters: EmployeeFilters): Promise<number> {
        return this.db.employee.count({ where: buildEmployeeWhere(filters) });
    }

    async exists(filters: EmployeeFilters): Promise<boolean> {
        const row = await this.db.employee.findFirst({
            where: buildEmployeeWhere(filters),
            select: { id: true },
        });
        return row !== null;
    }

    async create(entity: EmployeeEntity): Promise<EmployeeEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.employee.create({ data: toEmployeeCreateData(entity) });
            return toEmployeeEntity(row);
        });
    }

    async update(entity: EmployeeEntity): Promise<EmployeeEntity> {
        return mapPrismaErrors(async () => {
            const row = await this.db.employee.update({
                where: { id: entity.id },
                data: toEmployeeUpdateData(entity),
            });
            return toEmployeeEntity(row);
        });
    }

    async softDelete(id: string): Promise<void> {
        await mapPrismaErrors(() =>
            this.db.employee.update({ where: { id }, data: { deletedAt: new Date() } }),
        );
    }

    async hardDelete(id: string): Promise<void> {
        await mapPrismaErrors(() => this.db.employee.delete({ where: { id } }));
    }
}
