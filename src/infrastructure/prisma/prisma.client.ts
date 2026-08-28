/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Prisma client + the tenant-scoping extension.
 *
 * `any` is enabled for this file alone. Prisma's query-extension callback is
 * intentionally model-agnostic — `args` is a different shape for every model
 * and operation — so narrowing it would mean hand-writing a union over the
 * entire schema and rewriting it on every migration. This is the one place in
 * the codebase where that trade is worth making, and it is the reason the rest
 * of the codebase never has to think about tenant scoping at all.
 */
import { PrismaClient, Prisma } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MissingTenantScopeError } from "../../domain/errors";
import { getContext } from "../../shared/request-context";
import { config } from "../../config";

/**
 * Models that carry a `tenantId` and must never be read or written without a
 * tenant scope. `Tenant` is deliberately absent: it is the registry that
 * tenants live in, so scoping it to a tenant would be circular.
 *
 * ADDING A MODEL: if it has a tenantId column, add it here. A tenant-owned
 * model that is missing from this set silently loses its isolation, so the
 * guard test in `tenant-isolation.int.spec.ts` asserts that this set matches
 * every model in the schema that declares a tenantId field.
 */
export const TENANT_SCOPED_MODELS: ReadonlySet<string> = new Set([
    "User",
    "Employee",
    "Branch",
    "Session",
    "PasswordResetToken",
]);

const WHERE_OPERATIONS = new Set([
    "findUnique",
    "findUniqueOrThrow",
    "findFirst",
    "findFirstOrThrow",
    "findMany",
    "count",
    "aggregate",
    "groupBy",
    "update",
    "updateMany",
    "delete",
    "deleteMany",
]);

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

function withTenantWhere(where: any, tenantId: string): any {
    // Prisma's extendedWhereUnique (GA since v5) lets a unique lookup carry
    // extra non-unique filters, which is what makes `findUnique({ id })`
    // safely become `findUnique({ id, tenantId })` rather than needing to be
    // rewritten as findFirst.
    return { ...(where ?? {}), tenantId };
}

function withTenantData(data: any, tenantId: string): any {
    if (Array.isArray(data)) {
        return data.map((row) => ({ ...row, tenantId }));
    }
    return { ...(data ?? {}), tenantId };
}

/**
 * Injects the ambient tenant into every query against a tenant-owned model,
 * and REFUSES to run when no tenant scope is present.
 *
 * The refusal is the important half. A repository that forgets its
 * `where: { tenantId }` does not quietly return another customer's rows — it
 * throws, loudly, in development and in tests, long before production.
 */
export const tenantScopeExtension = Prisma.defineExtension({
    name: "tenant-scope",
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }: any) {
                if (!TENANT_SCOPED_MODELS.has(model)) {
                    return query(args);
                }

                const context = getContext();

                // Explicitly sanctioned cross-tenant work: login lookups,
                // refresh-token resolution, platform administration, seeding.
                if (context?.crossTenant) {
                    return query(args);
                }

                const tenantId = context?.tenantId;
                if (!tenantId) {
                    throw new MissingTenantScopeError(model, operation);
                }

                if (operation === "upsert") {
                    return query({
                        ...args,
                        where: withTenantWhere(args?.where, tenantId),
                        create: withTenantData(args?.create, tenantId),
                    });
                }

                if (CREATE_OPERATIONS.has(operation)) {
                    return query({ ...args, data: withTenantData(args?.data, tenantId) });
                }

                if (WHERE_OPERATIONS.has(operation)) {
                    return query({ ...args, where: withTenantWhere(args?.where, tenantId) });
                }

                return query(args);
            },
        },
    },
});

function createPrismaClient() {
    const adapter = new PrismaPg({ connectionString: config.databaseUrl });
    return new PrismaClient({
        adapter,
        log: config.isProduction ? ["warn", "error"] : ["warn", "error"],
    }).$extends(tenantScopeExtension);
}

declare global {
    var __prisma__: ReturnType<typeof createPrismaClient> | undefined;
}

// Reused across hot reloads in development so `tsx watch` does not open a new
// connection pool on every file save.
export const prisma = globalThis.__prisma__ ?? createPrismaClient();

if (!config.isProduction) {
    globalThis.__prisma__ = prisma;
}

export type ExtendedPrismaClient = typeof prisma;

/**
 * What a repository is given. Structurally satisfied by both the root client
 * and a `$transaction` callback client, so the same repository class works
 * inside and outside a transaction with no branching.
 */
export type PrismaTx = Omit<
    ExtendedPrismaClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

export async function connectPrisma(): Promise<void> {
    await prisma.$connect();
}

export async function disconnectPrisma(): Promise<void> {
    await prisma.$disconnect();
}
