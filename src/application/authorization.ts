import { ForbiddenError } from "../domain/errors";
import { UserRole, TENANT_ADMIN_ROLES } from "../domain/enums";
import type { AuthenticatedPrincipal } from "../domain/interfaces";

/**
 * Authorization decisions that depend on data, not just on a role name.
 *
 * Route-level `authorize(...)` middleware answers "may this role reach this
 * endpoint at all". It cannot answer "may this branch manager edit *this*
 * user", because that needs the record. Those checks belong here, in the
 * application layer, next to the operation they guard.
 */

export function hasRole(principal: AuthenticatedPrincipal, role: UserRole): boolean {
    return principal.roles.includes(role);
}

export function hasAnyRole(principal: AuthenticatedPrincipal, roles: readonly UserRole[]): boolean {
    return roles.some((role) => principal.roles.includes(role));
}

export function isPlatformAdmin(principal: AuthenticatedPrincipal): boolean {
    return hasRole(principal, UserRole.PlatformAdmin);
}

export function isTenantAdmin(principal: AuthenticatedPrincipal): boolean {
    return hasAnyRole(principal, TENANT_ADMIN_ROLES);
}

export function assertTenantAdmin(principal: AuthenticatedPrincipal): void {
    if (!isTenantAdmin(principal)) {
        throw new ForbiddenError("This action requires tenant administrator privileges");
    }
}

export function assertPlatformAdmin(principal: AuthenticatedPrincipal): void {
    if (!isPlatformAdmin(principal)) {
        throw new ForbiddenError("This action requires platform administrator privileges");
    }
}

/** A user may always act on their own record; otherwise tenant admin is required. */
export function assertSelfOrTenantAdmin(
    principal: AuthenticatedPrincipal,
    targetUserId: string,
): void {
    if (principal.userId === targetUserId) return;
    assertTenantAdmin(principal);
}

/**
 * Nobody may grant a role they do not themselves hold.
 *
 * Without this, any TenantAdmin can mint a PlatformAdmin and escalate out of
 * their own tenant — the single most common privilege-escalation hole in
 * role-based APIs, and one that route-level guards do not catch.
 */
export function assertCanAssignRoles(
    principal: AuthenticatedPrincipal,
    requestedRoles: readonly UserRole[],
): void {
    if (isPlatformAdmin(principal)) return;

    if (requestedRoles.includes(UserRole.PlatformAdmin)) {
        throw new ForbiddenError("Only a platform administrator can grant the PlatformAdmin role");
    }
    if (!isTenantAdmin(principal)) {
        throw new ForbiddenError("You do not have permission to assign roles");
    }
}
