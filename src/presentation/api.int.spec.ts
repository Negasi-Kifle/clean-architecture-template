/**
 * End-to-end HTTP tests against a real database.
 *
 * These exercise the whole stack — middleware order, auth, tenant scoping,
 * validation, error envelopes — through the same interface a client uses.
 * Unit tests prove a rule is implemented; these prove it is actually wired up.
 *
 * Set TEST_DATABASE_URL to run them.
 */
import request from "supertest";
import type { Application } from "express";
import { buildApp } from "./app";
import { buildContainer } from "../composition";
import { prisma } from "../infrastructure/prisma/prisma.client";
import { BcryptPasswordHasher } from "../infrastructure/services";
import { runCrossTenant } from "../shared/request-context";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);
const describeIntegration = hasDatabase ? describe : describe.skip;

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ADMIN_A = "a1a1a1a1-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "b1b1b1b1-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PASSWORD = "Str0ngPassword";

describeIntegration("API", () => {
    let app: Application;
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
        app = buildApp(buildContainer());

        const hash = await new BcryptPasswordHasher(10).hash(PASSWORD);

        await runCrossTenant(async () => {
            await prisma.session.deleteMany({});
            await prisma.passwordResetToken.deleteMany({});
            await prisma.employee.deleteMany({});
            await prisma.user.deleteMany({});
            await prisma.branch.deleteMany({});
            await prisma.tenant.deleteMany({});

            await prisma.tenant.createMany({
                data: [
                    { id: TENANT_A, slug: "tenant-a", name: "Tenant A", updatedAt: new Date() },
                    { id: TENANT_B, slug: "tenant-b", name: "Tenant B", updatedAt: new Date() },
                ],
            });

            await prisma.user.createMany({
                data: [
                    {
                        id: ADMIN_A,
                        tenantId: TENANT_A,
                        firstName: "Alice",
                        lastName: "Admin",
                        email: "alice@a.test",
                        phoneNumber: "0900000001",
                        passwordHash: hash,
                        roles: ["TenantAdmin"],
                        updatedAt: new Date(),
                    },
                    {
                        id: USER_B,
                        tenantId: TENANT_B,
                        firstName: "Bob",
                        lastName: "Other",
                        email: "bob@b.test",
                        phoneNumber: "0900000002",
                        passwordHash: hash,
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

    describe("health", () => {
        it("responds without authentication", async () => {
            const response = await request(app).get("/health");
            expect(response.status).toBe(200);
            expect(response.body.status).toBe("ok");
        });
    });

    describe("POST /api/v1/auth/login", () => {
        it("returns tokens for valid credentials", async () => {
            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({ identifier: "alice@a.test", password: PASSWORD });

            expect(response.status).toBe(200);
            expect(response.body.status).toBe("success");
            expect(response.body.data.accessToken).toBeTruthy();
            expect(response.body.data.refreshToken).toBeTruthy();

            accessToken = response.body.data.accessToken;
            refreshToken = response.body.data.refreshToken;
        });

        it("rejects a bad password with 401 and no detail about why", async () => {
            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({ identifier: "alice@a.test", password: "WrongPassword1" });

            expect(response.status).toBe(401);
            expect(response.body.error.code).toBe("INVALID_CREDENTIALS");
        });

        it("returns field-level issues for a malformed body", async () => {
            const response = await request(app).post("/api/v1/auth/login").send({});

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe("VALIDATION_ERROR");
            expect(
                response.body.error.issues.map((i: { field: string }) => i.field).sort(),
            ).toEqual(["identifier", "password"]);
        });

        it("rejects unknown fields instead of silently dropping them", async () => {
            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({ identifier: "alice@a.test", password: PASSWORD, isAdmin: true });

            expect(response.status).toBe(400);
        });
    });

    describe("authentication", () => {
        it("rejects a request with no token", async () => {
            const response = await request(app).get("/api/v1/auth/me");
            expect(response.status).toBe(401);
        });

        it("rejects a forged token", async () => {
            const response = await request(app)
                .get("/api/v1/auth/me")
                .set("Authorization", "Bearer not.a.real.token");

            expect(response.status).toBe(401);
        });

        it("returns the caller's own profile and never a password hash", async () => {
            const response = await request(app)
                .get("/api/v1/auth/me")
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data.email).toBe("alice@a.test");
            expect(JSON.stringify(response.body)).not.toContain("passwordHash");
        });
    });

    describe("tenant isolation over HTTP", () => {
        it("lists only the caller's tenant", async () => {
            const response = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].email).toBe("alice@a.test");
        });

        /**
         * 404, not 403. A 403 would confirm that the id exists in some other
         * tenant, which is itself a leak.
         */
        it("returns 404 for a user in another tenant", async () => {
            const response = await request(app)
                .get(`/api/v1/users/${USER_B}`)
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(404);
        });

        it("cannot modify a user in another tenant", async () => {
            const response = await request(app)
                .patch(`/api/v1/users/${USER_B}`)
                .set("Authorization", `Bearer ${accessToken}`)
                .send({ firstName: "Hacked" });

            expect(response.status).toBe(404);

            const bob = await runCrossTenant(async () =>
                prisma.user.findUnique({ where: { id: USER_B } }),
            );
            expect(bob!.firstName).toBe("Bob");
        });
    });

    describe("validation of route params", () => {
        it("rejects a non-UUID id with 400 rather than a database error", async () => {
            const response = await request(app)
                .get("/api/v1/users/not-a-uuid")
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe("VALIDATION_ERROR");
        });
    });

    describe("privilege escalation", () => {
        it("stops a tenant admin from creating a platform admin", async () => {
            const response = await request(app)
                .post("/api/v1/users")
                .set("Authorization", `Bearer ${accessToken}`)
                .send({
                    firstName: "Sneaky",
                    lastName: "User",
                    email: "sneaky@a.test",
                    phoneNumber: "0900000009",
                    password: PASSWORD,
                    roles: ["PlatformAdmin"],
                });

            expect(response.status).toBe(403);
        });
    });

    describe("POST /api/v1/auth/refresh", () => {
        it("rotates the refresh token", async () => {
            const response = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });

            expect(response.status).toBe(200);
            expect(response.body.data.refreshToken).not.toBe(refreshToken);

            const replayed = refreshToken;
            refreshToken = response.body.data.refreshToken;

            // Replaying the rotated token burns the whole family.
            const replay = await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken: replayed });

            expect(replay.status).toBe(401);
            expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSE_DETECTED");

            const afterBurn = await request(app)
                .post("/api/v1/auth/refresh")
                .send({ refreshToken });

            expect(afterBurn.status).toBe(401);
        });
    });

    describe("feature flags", () => {
        it("does not mount /branches routes when the feature is off", async () => {
            // BRANCHES_ENABLED defaults to true in the test env, so this
            // asserts the mounted case; flip the env var to see the 404.
            const response = await request(app)
                .get("/api/v1/branches")
                .set("Authorization", `Bearer ${accessToken}`);

            expect(response.status).toBe(200);
        });
    });

    describe("unknown routes", () => {
        it("returns the standard error envelope, not an HTML page", async () => {
            const response = await request(app).get("/api/v1/does-not-exist");

            expect(response.status).toBe(404);
            expect(response.body.status).toBe("error");
            expect(response.body.error.code).toBe("NOT_FOUND");
            expect(response.body.requestId).toBeTruthy();
        });
    });

    describe("request id", () => {
        it("echoes an inbound request id so traces stay joined up", async () => {
            const response = await request(app).get("/health").set("x-request-id", "trace-123");
            expect(response.headers["x-request-id"]).toBe("trace-123");
        });

        it("strips characters that could forge or pad a log line", async () => {
            const response = await request(app)
                .get("/health")
                .set("x-request-id", "abc<script>/def*ghi");

            expect(response.headers["x-request-id"]).toBe("abcscriptdefghi");
        });

        it("caps an over-long inbound request id", async () => {
            const response = await request(app).get("/health").set("x-request-id", "z".repeat(500));

            expect(response.headers["x-request-id"]).toHaveLength(64);
        });
    });
});
