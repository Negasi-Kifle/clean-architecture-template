import type { UserEntity } from "../entities";
import type { UserRole, UserType } from "../enums";
import type { SoftDeleteFilter } from "../interfaces";
import type { CrudRepository } from "./base.repository.interface";

export interface UserFilters extends SoftDeleteFilter {
    /** Case-insensitive match across first name, last name, email and phone. */
    search?: string;
    email?: string;
    phoneNumber?: string;
    roles?: UserRole[];
    userType?: UserType;
    isActive?: boolean;
    createdFrom?: Date;
    createdTo?: Date;
}

export type UserSortField =
    "createdAt" | "updatedAt" | "firstName" | "lastName" | "email" | "lastLoginAt";

/**
 * Tenant-scoped user access. Every method here is automatically confined to
 * the caller's tenant.
 *
 * Cross-tenant identity lookups (resolving a login by email before any tenant
 * is known) deliberately live on `IIdentityRepository` instead, so that the
 * small set of queries allowed to span tenants is visible in one file.
 */
export interface IUserRepository extends CrudRepository<UserEntity, UserFilters, UserSortField> {
    findByEmail(email: string): Promise<UserEntity | null>;
    /** Excludes `excludeUserId` so an update can check uniqueness against itself. */
    existsByEmailOrPhone(
        email: string | undefined,
        phoneNumber: string | undefined,
        excludeUserId?: string,
    ): Promise<{ emailTaken: boolean; phoneTaken: boolean }>;
    countByRole(role: UserRole): Promise<number>;
}
