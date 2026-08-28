/**
 * Authorization roles.
 *
 * Kept as a domain enum rather than importing Prisma's generated enum so the
 * domain layer stays free of infrastructure. The two are kept in sync by a
 * compile-time check in `infrastructure/prisma/mappers/enum.guard.ts`.
 */
export enum UserRole {
    /** Operates across every tenant. Belongs to the reserved system tenant. */
    PlatformAdmin = "PlatformAdmin",
    /** Full control within their own tenant. */
    TenantAdmin = "TenantAdmin",
    /** Scoped to the branch(es) they manage. */
    BranchManager = "BranchManager",
    /** Ordinary authenticated user. */
    Member = "Member",
}

/** Roles that may act outside their own tenant. */
export const CROSS_TENANT_ROLES: readonly UserRole[] = [UserRole.PlatformAdmin];

/** Roles that may administer their own tenant's users, employees and branches. */
export const TENANT_ADMIN_ROLES: readonly UserRole[] = [
    UserRole.PlatformAdmin,
    UserRole.TenantAdmin,
];
