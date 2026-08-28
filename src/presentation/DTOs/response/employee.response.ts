import type { EmployeeEntity } from "../../../domain/entities";

export interface EmployeeResponse {
    id: string;
    userId: string;
    branchId: string | null;
    employeeNumber: string | null;
    jobTitle: string | null;
    hireDate: string | null;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        isActive: boolean;
    };
    branch?: {
        id: string;
        name: string;
        code: string | null;
        city: string | null;
        country: string | null;
        isActive: boolean;
    } | null;
}

export function toEmployeeResponse(employee: EmployeeEntity): EmployeeResponse {
    const p = employee.toPrimitives();
    return {
        id: p.id,
        userId: p.userId,
        branchId: p.branchId,
        employeeNumber: p.employeeNumber,
        jobTitle: p.jobTitle,
        hireDate: p.hireDate?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        ...(employee.user ? { user: employee.user } : {}),
        ...(employee.branch !== undefined ? { branch: employee.branch } : {}),
    };
}
