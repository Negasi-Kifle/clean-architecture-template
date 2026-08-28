import type { BranchEntity } from "../entities";
import type { SoftDeleteFilter } from "../interfaces";
import type { CrudRepository } from "./base.repository.interface";

export interface BranchFilters extends SoftDeleteFilter {
    search?: string;
    code?: string;
    city?: string;
    country?: string;
    isActive?: boolean;
}

export type BranchSortField = "createdAt" | "updatedAt" | "name" | "code" | "city";

export interface IBranchRepository extends CrudRepository<
    BranchEntity,
    BranchFilters,
    BranchSortField
> {
    findByCode(code: string): Promise<BranchEntity | null>;
    /** Number of non-deleted employees still pointing at this branch. */
    countEmployees(branchId: string): Promise<number>;
}
