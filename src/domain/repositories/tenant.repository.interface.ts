import type { TenantEntity } from "../entities";
import type { SoftDeleteFilter } from "../interfaces";
import type { CrudRepository } from "./base.repository.interface";

export interface TenantFilters extends SoftDeleteFilter {
    search?: string;
    slug?: string;
    isActive?: boolean;
    /** Defaults to false: the reserved platform tenant is not a customer tenant. */
    includeSystem?: boolean;
}

export type TenantSortField = "createdAt" | "updatedAt" | "name" | "slug";

/**
 * The tenant registry is NOT tenant-scoped — it is the thing tenants are
 * scoped to. Every method here runs outside the tenant filter, which is why
 * only platform-admin paths may reach it.
 */
export interface ITenantRepository extends CrudRepository<
    TenantEntity,
    TenantFilters,
    TenantSortField
> {
    findBySlug(slug: string): Promise<TenantEntity | null>;
}
