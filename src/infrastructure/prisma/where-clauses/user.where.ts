import type { Prisma } from "../generated/client";
import type { UserFilters } from "../../../domain/repositories";
import type { UserRole, UserType } from "../../../domain/enums";
import { searchAcross, softDeleteWhere } from "./sort";

export function buildUserWhere(filters: UserFilters): Prisma.UserWhereInput {
    const or = searchAcross(filters.search, ["firstName", "lastName", "email", "phoneNumber"]);

    const createdAt =
        filters.createdFrom || filters.createdTo
            ? {
                  ...(filters.createdFrom && { gte: filters.createdFrom }),
                  ...(filters.createdTo && { lte: filters.createdTo }),
              }
            : undefined;

    return {
        ...softDeleteWhere(filters.includeDeleted),
        ...(filters.email !== undefined && {
            email: { equals: filters.email, mode: "insensitive" as const },
        }),
        ...(filters.phoneNumber !== undefined && { phoneNumber: filters.phoneNumber }),
        // `hasSome` rather than `hasEvery`: filtering by [Admin, Manager] means
        // "either kind of privileged user", not "users holding both roles".
        ...(filters.roles !== undefined &&
            filters.roles.length > 0 && { roles: { hasSome: filters.roles as UserRole[] } }),
        ...(filters.userType !== undefined && { userType: filters.userType as UserType }),
        ...(filters.isActive !== undefined && { isActive: filters.isActive }),
        ...(createdAt && { createdAt }),
        ...(or && { OR: or }),
    };
}
