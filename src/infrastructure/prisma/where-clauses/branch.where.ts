import type { Prisma } from "../generated/client";
import type { BranchFilters } from "../../../domain/repositories";
import { searchAcross, softDeleteWhere } from "./sort";

export function buildBranchWhere(filters: BranchFilters): Prisma.BranchWhereInput {
    const or = searchAcross(filters.search, ["name", "code", "city"]);

    return {
        ...softDeleteWhere(filters.includeDeleted),
        ...(filters.code !== undefined && { code: filters.code }),
        ...(filters.city !== undefined && {
            city: { equals: filters.city, mode: "insensitive" as const },
        }),
        ...(filters.country !== undefined && {
            country: { equals: filters.country, mode: "insensitive" as const },
        }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(or && { OR: or }),
    };
}
