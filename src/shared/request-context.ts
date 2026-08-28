import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Per-request ambient state.
 *
 * Why AsyncLocalStorage rather than threading a context object through every
 * signature: the tenant scope has to reach the Prisma client, which sits four
 * layers below the HTTP request. Passing it explicitly would mean every
 * repository method, every use case and every controller grows a `tenantId`
 * parameter — and the one place someone forgets it is a cross-tenant leak.
 *
 * The invariant that makes this safe: the store is populated exactly once, by
 * `tenantContextMiddleware`, and the Prisma extension THROWS when it is absent
 * for a tenant-owned model. Forgetting to set it fails loudly and immediately;
 * it never silently reads another tenant's rows.
 */
export interface RequestContext {
    /** Correlates every log line for one request. */
    readonly requestId: string;
    /** Resolved tenant. Undefined only before the tenant middleware has run. */
    readonly tenantId?: string;
    readonly userId?: string;
    /**
     * When true, tenant scoping is intentionally bypassed. Only set by
     * `runCrossTenant`, which is reachable from platform-admin paths and the
     * identity lookups that must span tenants (login, refresh, password reset).
     */
    readonly crossTenant: boolean;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Opens a context around a SYNCHRONOUS call.
 *
 * Use this only for middleware, where `fn` is `() => next()`. Anything that
 * touches Prisma must go through `runWithTenant` / `runCrossTenant` instead —
 * see the warning on those.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
}

export function getContext(): RequestContext | undefined {
    return storage.getStore();
}

export function requireContext(): RequestContext {
    const context = storage.getStore();
    if (!context) {
        throw new Error(
            "No request context. Code that touches tenant-owned data must run inside " +
                "runWithContext() — in HTTP this is done by tenantContextMiddleware, in " +
                "scripts and jobs call runWithContext() yourself.",
        );
    }
    return context;
}

/**
 * Run `fn` with tenant scoping disabled.
 *
 * Legitimate uses are narrow and each is a deliberate, reviewed decision:
 *   - login / refresh / password-reset lookups, which resolve a user *before*
 *     any tenant is known;
 *   - platform-admin operations over the tenant registry;
 *   - the seed script and migrations.
 *
 * Anything else that reaches for this is almost certainly a design mistake.
 */
export async function runCrossTenant<T>(fn: () => Promise<T>): Promise<T> {
    const current = storage.getStore();
    return storage.run(
        {
            requestId: current?.requestId ?? "system",
            tenantId: current?.tenantId,
            userId: current?.userId,
            crossTenant: true,
        },
        // See the note on runWithTenant: the await must happen INSIDE the
        // context, because a Prisma promise is lazy.
        async () => await fn(),
    );
}

/**
 * Narrows the context to one tenant for the duration of `fn`.
 *
 * WHY THIS AWAITS INSTEAD OF JUST RETURNING `storage.run(ctx, fn)`:
 *
 * A Prisma query is a lazy thenable. `prisma.user.findMany()` builds a
 * PrismaPromise and executes NOTHING until something calls `.then` on it. With
 * a plain `storage.run(ctx, () => prisma.user.findMany())`, `run` returns that
 * unexecuted promise, the context closes, and the query — along with the
 * extension that reads the tenant from the context — fires later, in whatever
 * context the eventual `await` happens to be in. In practice that means no
 * context at all.
 *
 * Awaiting inside means `.then` is called while the context is still open. The
 * failure mode without it is not subtle in this codebase — the extension
 * throws MissingTenantScopeError rather than quietly reading every tenant —
 * but that is a property of failing closed, not of the plumbing being right.
 */
export async function runWithTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const current = storage.getStore();
    return storage.run(
        {
            requestId: current?.requestId ?? "system",
            tenantId,
            userId: current?.userId,
            crossTenant: false,
        },
        async () => await fn(),
    );
}
