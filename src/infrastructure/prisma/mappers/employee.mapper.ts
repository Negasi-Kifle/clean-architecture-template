import type { Employee } from "../generated/client";
import { EmployeeEntity } from "../../../domain/entities";
import { toUserSummary, type UserSummaryRow } from "./user.mapper";
import { toBranchSummary, type BranchSummaryRow } from "./branch.mapper";

type EmployeeRowWithRelations = Employee & {
    user?: UserSummaryRow;
    branch?: BranchSummaryRow | null;
};

export function toEmployeeEntity(row: EmployeeRowWithRelations): EmployeeEntity {
    return EmployeeEntity.rehydrate(
        {
            id: row.id,
            tenantId: row.tenantId,
            userId: row.userId,
            branchId: row.branchId,
            employeeNumber: row.employeeNumber,
            jobTitle: row.jobTitle,
            hireDate: row.hireDate,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
        },
        {
            user: row.user ? toUserSummary(row.user) : undefined,
            branch:
                row.branch === undefined ? undefined : row.branch && toBranchSummary(row.branch),
        },
    );
}

export function toEmployeeCreateData(entity: EmployeeEntity) {
    const p = entity.toPrimitives();
    return {
        tenantId: p.tenantId,
        userId: p.userId,
        branchId: p.branchId,
        employeeNumber: p.employeeNumber,
        jobTitle: p.jobTitle,
        hireDate: p.hireDate,
    };
}

export function toEmployeeUpdateData(entity: EmployeeEntity) {
    const p = entity.toPrimitives();
    return {
        branchId: p.branchId,
        employeeNumber: p.employeeNumber,
        jobTitle: p.jobTitle,
        hireDate: p.hireDate,
        deletedAt: p.deletedAt,
    };
}
