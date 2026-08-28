import type { Prisma } from "../generated/client";
import type { TenantFilters } from "../../../domain/repositories";
import { searchAcross, softDeleteWhere } from "./sort";

export function buildTenantWhere(filters: TenantFilters): Prisma.TenantWhereInput {
    const or = searchAcross(filters.search, ["name", "slug"]);

    return {
        ...softDeleteWhere(filters.includeDeleted),
        // The reserved platform tenant is not a customer workspace and must
        // not show up in tenant listings.
        ...(filters.includeSystem ? {} : { isSystem: false }),
        ...(filters.slug !== undefined && { slug: filters.slug }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(or && { OR: or }),
    };
}
