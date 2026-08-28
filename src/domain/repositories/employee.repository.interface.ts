import type { EmployeeEntity, UserEntity } from "../entities";
import type { SoftDeleteFilter } from "../interfaces";
import type { CrudRepository } from "./base.repository.interface";

export interface EmployeeFilters extends SoftDeleteFilter {
    /** Matches the related user's name, email or phone, plus employee number. */
    search?: string;
    branchId?: string | null;
    employeeNumber?: string;
    jobTitle?: string;
    isActive?: boolean;
}

export type EmployeeSortField = "createdAt" | "updatedAt" | "employeeNumber" | "hireDate";

export interface IEmployeeRepository extends CrudRepository<
    EmployeeEntity,
    EmployeeFilters,
    EmployeeSortField
> {
    findByUserId(userId: string): Promise<EmployeeEntity | null>;
    /**
     * Detail read: attaches the wider user projection and the branch.
     * Separate from `findById` so list queries are not forced to over-fetch.
     */
    findDetailById(id: string): Promise<EmployeeEntity | null>;
    findByEmployeeNumber(employeeNumber: string): Promise<EmployeeEntity | null>;
}

/** Result of the create-user-and-employee transaction. */
export interface EmployeeWithUser {
    employee: EmployeeEntity;
    user: UserEntity;
}
