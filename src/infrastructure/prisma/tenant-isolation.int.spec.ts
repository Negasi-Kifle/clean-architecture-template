/**
 * Tenant isolation — integration tests against a real PostgreSQL.
 *
 * These are the most important tests in the template. Everything else is a
 * bug; a failure here is a data breach. They run against a real database
 * because the property under test is a property of the QUERIES, and a fake
 * repository would happily agree with whatever the code does.
 *
 * Set TEST_DATABASE_URL to run them (`docker compose up -d postgres-test`).
 * Without it they skip rather than fail, so `npm test` stays useful offline.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma, TENANT_SCOPED_MODELS } from "./prisma.client";
import { runCrossTenant, runWithContext, runWithTenant } from "../../shared/request-context";
import { MissingTenantScopeError } from "../../domain/errors";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasDatabase ? describe : describe.skip;

if (!hasDatabase) {
    console.warn("TEST_DATABASE_URL is not set — skipping tenant isolation integration tests");
}

/**
 * A guard, not an isolation test: it fails when someone adds a tenant-owned
 * model to the schema and forgets to register it for scoping. That omission is
 * silent at runtime — the model simply has no isolation — so it needs a test
 * that reads the schema rather than the code.
 */
describe("TENANT_SCOPED_MODELS", () => {
    it("lists every model in the schema that declares a tenantId", () => {
        const schema = readFileSync(join(__dirname, "schema.prisma"), "utf8");

        const modelsWithTenantId = [...schema.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)]
            .filter(([, , body]) => /^\s*tenantId\s+String/m.test(body ?? ""))
            .map(([, name]) => name as string);

        expect(modelsWithTenantId.sort()).toEqual([...TENANT_SCOPED_MODELS].sort());
    });
});

describeIntegration("tenant scoping", () => {
    const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const userA = "a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const userB = "b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    beforeEach(async () => {
        await runCrossTenant(async () => {
            await prisma.session.deleteMany({});
            await prisma.passwordResetToken.deleteMany({});
            await prisma.employee.deleteMany({});
            await prisma.user.deleteMany({});
            await prisma.branch.deleteMany({});
            await prisma.tenant.deleteMany({});

            await prisma.tenant.createMany({
                data: [
                    { id: tenantA, slug: "tenant-a", name: "Tenant A", updatedAt: new Date() },
                    { id: tenantB, slug: "tenant-b", name: "Tenant B", updatedAt: new Date() },
                ],
            });

            await prisma.user.createMany({
                data: [
                    {
                        id: userA,
                        tenantId: tenantA,
                        firstName: "Alice",
                        lastName: "A",
                        email: "alice@a.test",
                        phoneNumber: "0900000001",
                        passwordHash: "x",
                        roles: ["Member"],
                        updatedAt: new Date(),
                    },
                    {
                        id: userB,
                        tenantId: tenantB,
                        firstName: "Bob",
                        lastName: "B",
                        email: "bob@b.test",
                        phoneNumber: "0900000002",
                        passwordHash: "x",
                        roles: ["Member"],
                        updatedAt: new Date(),
                    },
                ],
            });
        });
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("lists only the current tenant's rows", async () => {
        const rows = await runWithTenant(tenantA, async () => prisma.user.findMany({}));

        expect(rows).toHaveLength(1);
        expect(rows[0]!.email).toBe("alice@a.test");
    });

    /**
     * The scenario people assume is safe because the id is a UUID: guessing
     * one is hard, but leaking one in a log, a URL or an export is not.
     */
    it("cannot read another tenant's row by its primary key", async () => {
        const row = await runWithTenant(tenantA, async () =>
            prisma.user.findUnique({ where: { id: userB } }),
        );

        expect(row).toBeNull();
    });

    it("cannot read another tenant's row by a unique business key", async () => {
        const row = await runWithTenant(tenantA, async () =>
            prisma.user.findUnique({ where: { email: "bob@b.test" } }),
        );

        expect(row).toBeNull();
    });

    it("cannot update another tenant's row", async () => {
        await expect(
            runWithTenant(tenantA, async () =>
                prisma.user.update({ where: { id: userB }, data: { firstName: "Hacked" } }),
            ),
        ).rejects.toThrow();

        const bob = await runCrossTenant(async () =>
            prisma.user.findUnique({ where: { id: userB } }),
        );
        expect(bob!.firstName).toBe("Bob");
    });

    it("cannot delete another tenant's rows with deleteMany", async () => {
        const result = await runWithTenant(tenantA, async () => prisma.user.deleteMany({}));

        expect(result.count).toBe(1);
        const survivors = await runCrossTenant(async () => prisma.user.findMany({}));
        expect(survivors.map((u) => u.email)).toEqual(["bob@b.test"]);
    });

    it("cannot count across tenants", async () => {
        const count = await runWithTenant(tenantA, async () => prisma.user.count());
        expect(count).toBe(1);
    });

    it("stamps the current tenant onto a create that does not supply one", async () => {
        const created = await runWithTenant(tenantA, async () =>
            prisma.user.create({
                data: {
                    firstName: "New",
                    lastName: "Person",
                    email: "new@a.test",
                    phoneNumber: "0900000003",
                    passwordHash: "x",
                    roles: ["Member"],
                    updatedAt: new Date(),
                    // No tenantId. TypeScript would demand one; the extension
                    // supplies it, which is what keeps every write scoped.
                } as never,
            }),
        );

        expect(created.tenantId).toBe(tenantA);
    });

    it("overrides a create that tries to plant a row in another tenant", async () => {
        const created = await runWithTenant(tenantA, async () =>
            prisma.user.create({
                data: {
                    tenantId: tenantB,
                    firstName: "Smuggled",
                    lastName: "Row",
                    email: "smuggled@a.test",
                    phoneNumber: "0900000004",
                    passwordHash: "x",
                    roles: ["Member"],
                    updatedAt: new Date(),
                },
            }),
        );

        expect(created.tenantId).toBe(tenantA);
    });

    /**
     * Fail closed. A query with no tenant scope must not fall back to
     * "everything" — the failure mode of every isolation bug that ever
     * shipped.
     */
    it("refuses to query a tenant-owned model with no scope at all", async () => {
        await expect(
            runWithContext(
                { requestId: "test", crossTenant: false },
                async () => await prisma.user.findMany({}),
            ),
        ).rejects.toBeInstanceOf(MissingTenantScopeError);
    });

    it("allows the tenant registry itself to be queried unscoped", async () => {
        const tenants = await runWithContext(
            { requestId: "test", crossTenant: false },
            async () => await prisma.tenant.findMany({}),
        );

        expect(tenants).toHaveLength(2);
    });

    it("sees every tenant inside runCrossTenant", async () => {
        const rows = await runCrossTenant(async () => prisma.user.findMany({}));
        expect(rows).toHaveLength(2);
    });

    it("keeps the scope inside a transaction", async () => {
        const rows = await runWithTenant(tenantA, async () =>
            prisma.$transaction(async (tx) => tx.user.findMany({})),
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]!.tenantId).toBe(tenantA);
    });

    it("scopes related models too, not just User", async () => {
        await runWithTenant(tenantB, async () =>
            prisma.branch.create({
                data: { tenantId: tenantB, name: "B branch", updatedAt: new Date() },
            }),
        );

        const fromA = await runWithTenant(tenantA, async () => prisma.branch.findMany({}));
        const fromB = await runWithTenant(tenantB, async () => prisma.branch.findMany({}));

        expect(fromA).toHaveLength(0);
        expect(fromB).toHaveLength(1);
    });

    it("does not leak across concurrent requests", async () => {
        const [fromA, fromB] = await Promise.all([
            runWithTenant(tenantA, async () => {
                await new Promise((resolve) => setTimeout(resolve, 20));
                return prisma.user.findMany({});
            }),
            runWithTenant(tenantB, async () => prisma.user.findMany({})),
        ]);

        expect(fromA.map((u) => u.email)).toEqual(["alice@a.test"]);
        expect(fromB.map((u) => u.email)).toEqual(["bob@b.test"]);
    });
});
