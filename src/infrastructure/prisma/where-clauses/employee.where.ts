import type { Prisma } from "../generated/client";
import type { EmployeeFilters } from "../../../domain/repositories";
import { softDeleteWhere } from "./sort";

export function buildEmployeeWhere(filters: EmployeeFilters): Prisma.EmployeeWhereInput {
    const term = filters.search?.trim();

    return {
        ...softDeleteWhere(filters.includeDeleted),
        // `null` filters for unassigned employees; `undefined` means no filter.
        // Collapsing the two would make "show me unassigned staff" impossible.
        ...(filters.branchId !== undefined && { branchId: filters.branchId }),
        ...(filters.employeeNumber !== undefined && { employeeNumber: filters.employeeNumber }),
        ...(filters.jobTitle !== undefined && {
            jobTitle: { contains: filters.jobTitle, mode: "insensitive" as const },
        }),
        ...(filters.isActive !== undefined && { user: { isActive: filters.isActive } }),
        ...(term && {
            OR: [
                { employeeNumber: { contains: term, mode: "insensitive" as const } },
                { jobTitle: { contains: term, mode: "insensitive" as const } },
                { user: { firstName: { contains: term, mode: "insensitive" as const } } },
                { user: { lastName: { contains: term, mode: "insensitive" as const } } },
                { user: { email: { contains: term, mode: "insensitive" as const } } },
                { user: { phoneNumber: { contains: term, mode: "insensitive" as const } } },
            ],
        }),
    };
}
