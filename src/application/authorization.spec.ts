import {
    assertCanAssignRoles,
    assertPlatformAdmin,
    assertSelfOrTenantAdmin,
    assertTenantAdmin,
} from "./authorization";
import { UserRole } from "../domain/enums";
import { ForbiddenError } from "../domain/errors";
import type { AuthenticatedPrincipal } from "../domain/interfaces";

function principal(roles: UserRole[], userId = "user-1"): AuthenticatedPrincipal {
    return { userId, tenantId: "tenant-1", roles, issuedAt: 0 };
}

describe("assertCanAssignRoles", () => {
    /**
     * The privilege-escalation hole this closes: without it any tenant admin
     * can mint a PlatformAdmin and walk straight out of their own tenant.
     * Route-level role guards do not catch this — the request IS from an
     * admin, it is the payload that is dangerous.
     */
    it("stops a tenant admin from granting PlatformAdmin", () => {
        expect(() =>
            assertCanAssignRoles(principal([UserRole.TenantAdmin]), [UserRole.PlatformAdmin]),
        ).toThrow(ForbiddenError);
    });

    it("lets a tenant admin grant roles at or below their own level", () => {
        expect(() =>
            assertCanAssignRoles(principal([UserRole.TenantAdmin]), [
                UserRole.TenantAdmin,
                UserRole.BranchManager,
                UserRole.Member,
            ]),
        ).not.toThrow();
    });

    it("lets a platform admin grant anything", () => {
        expect(() =>
            assertCanAssignRoles(principal([UserRole.PlatformAdmin]), [UserRole.PlatformAdmin]),
        ).not.toThrow();
    });

    it("stops a branch manager from assigning roles at all", () => {
        expect(() =>
            assertCanAssignRoles(principal([UserRole.BranchManager]), [UserRole.Member]),
        ).toThrow(ForbiddenError);
    });
});

describe("assertSelfOrTenantAdmin", () => {
    it("allows a user to act on their own record", () => {
        expect(() => assertSelfOrTenantAdmin(principal([UserRole.Member]), "user-1")).not.toThrow();
    });

    it("blocks a member from acting on someone else's record", () => {
        expect(() => assertSelfOrTenantAdmin(principal([UserRole.Member]), "user-2")).toThrow(
            ForbiddenError,
        );
    });

    it("allows a tenant admin to act on anyone in their tenant", () => {
        expect(() =>
            assertSelfOrTenantAdmin(principal([UserRole.TenantAdmin]), "user-2"),
        ).not.toThrow();
    });
});

describe("role assertions", () => {
    it("treats PlatformAdmin as a superset of TenantAdmin", () => {
        expect(() => assertTenantAdmin(principal([UserRole.PlatformAdmin]))).not.toThrow();
    });

    it("does not treat TenantAdmin as a PlatformAdmin", () => {
        expect(() => assertPlatformAdmin(principal([UserRole.TenantAdmin]))).toThrow(
            ForbiddenError,
        );
    });
});
