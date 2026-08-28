import type { UserRole, UserType } from "../enums";

/**
 * Read-only shapes returned alongside a parent entity.
 *
 * The point of a projection type is that `passwordHash` is not on it. That
 * makes "never leak the hash through an include" a type error rather than a
 * code-review convention, and it keeps the SELECT list small.
 */

export interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    isActive: boolean;
}

/** Wider projection for detail views. Still no password hash. */
export interface UserDetailSummary extends UserSummary {
    tenantId: string;
    roles: UserRole[];
    userType: UserType;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface BranchSummary {
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    country: string | null;
    isActive: boolean;
}

export interface TenantSummary {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
}
