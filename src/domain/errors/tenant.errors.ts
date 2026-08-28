import { DomainError } from "./domain.error";

/**
 * The tenant for this request could not be determined, or the resolved tenant
 * is inactive. Fails closed: no tenant means no data, never all data.
 */
export class TenantResolutionError extends DomainError {
    readonly code = "TENANT_UNRESOLVED";

    constructor(message = "Unable to resolve the tenant for this request") {
        super(message);
    }
}

/**
 * A tenant-owned query ran without a tenant scope in place.
 *
 * Not operational: reaching this means a bug in wiring, not bad user input.
 * It is thrown by the Prisma extension and must never be swallowed.
 */
export class MissingTenantScopeError extends DomainError {
    readonly code = "MISSING_TENANT_SCOPE";
    override readonly isOperational = false;

    constructor(model: string, operation: string) {
        super(
            `Refusing to run ${operation} on tenant-owned model "${model}" with no tenant scope. ` +
                `This is a wiring bug: the call must run inside runWithContext() with a tenantId, ` +
                `or inside runCrossTenant() if crossing tenants is genuinely intended.`,
        );
    }
}
