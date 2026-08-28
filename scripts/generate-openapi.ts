/**
 * Generates docs/openapi.json from the Zod request schemas.
 *
 * The point is that the spec is DERIVED, not maintained. A hand-written
 * OpenAPI document is accurate on the day it is written and wrong within a
 * sprint; generating it from the same schemas the server validates with means
 * the two cannot drift.
 *
 * Zod 4 converts natively via `z.toJSONSchema`, which emits JSON Schema
 * 2020-12 — the dialect OpenAPI 3.1 uses, so no translation layer is needed.
 *
 * Run: npm run generate:openapi
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";

import * as authDtos from "../src/presentation/DTOs/request/auth";
import * as userDtos from "../src/presentation/DTOs/request/users";
import * as employeeDtos from "../src/presentation/DTOs/request/employees";
import * as branchDtos from "../src/presentation/DTOs/request/branches";
import * as tenantDtos from "../src/presentation/DTOs/request/tenants";
import { API_PREFIX } from "../src/presentation/app";

type JsonSchema = Record<string, unknown>;

/**
 * `io: "input"` describes what a client SENDS (before Zod's transforms and
 * defaults run), which is what a request body schema must document.
 * `unrepresentable: "any"` keeps a `.transform()` from aborting the whole
 * conversion — those fields degrade to `{}` rather than failing the build.
 */
function toSchema(schema: z.ZodType): JsonSchema {
    return z.toJSONSchema(schema, {
        target: "draft-2020-12",
        io: "input",
        unrepresentable: "any",
    }) as JsonSchema;
}

interface Endpoint {
    method: "get" | "post" | "patch" | "delete";
    path: string;
    tag: string;
    summary: string;
    auth: boolean;
    roles?: string[];
    body?: z.ZodType;
    query?: z.ZodType;
    hasIdParam?: boolean;
}

const endpoints: Endpoint[] = [
    // ── auth ────────────────────────────────────────────────────────────
    { method: "post", path: "/auth/login", tag: "Auth", summary: "Sign in with email or phone", auth: false, body: authDtos.loginSchema },
    { method: "post", path: "/auth/refresh", tag: "Auth", summary: "Rotate the refresh token", auth: false, body: authDtos.refreshTokenSchema },
    { method: "post", path: "/auth/logout", tag: "Auth", summary: "Revoke the current session", auth: false, body: authDtos.logoutSchema },
    { method: "post", path: "/auth/logout-all", tag: "Auth", summary: "Revoke every session for the caller", auth: true },
    { method: "post", path: "/auth/change-password", tag: "Auth", summary: "Change your own password", auth: true, body: authDtos.changePasswordSchema },
    { method: "post", path: "/auth/forgot-password", tag: "Auth", summary: "Request a password-reset link", auth: false, body: authDtos.forgotPasswordSchema },
    { method: "post", path: "/auth/reset-password", tag: "Auth", summary: "Set a new password using a reset token", auth: false, body: authDtos.resetPasswordSchema },
    { method: "get", path: "/auth/verify-reset-token", tag: "Auth", summary: "Check whether a reset link is still valid", auth: false, query: authDtos.verifyResetTokenSchema },
    { method: "get", path: "/auth/me", tag: "Auth", summary: "The authenticated user's profile", auth: true },
    { method: "get", path: "/auth/sessions", tag: "Auth", summary: "List the caller's active sessions", auth: true },

    // ── users ───────────────────────────────────────────────────────────
    { method: "get", path: "/users", tag: "Users", summary: "List users in the caller's tenant", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], query: userDtos.listUsersSchema },
    { method: "post", path: "/users", tag: "Users", summary: "Create a user", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], body: userDtos.createUserSchema },
    { method: "patch", path: "/users/me", tag: "Users", summary: "Update your own profile", auth: true, body: userDtos.updateMeSchema },
    { method: "get", path: "/users/{id}", tag: "Users", summary: "Get a user", auth: true, hasIdParam: true },
    { method: "patch", path: "/users/{id}", tag: "Users", summary: "Update a user", auth: true, hasIdParam: true, body: userDtos.updateUserSchema },
    { method: "delete", path: "/users/{id}", tag: "Users", summary: "Soft-delete a user", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], hasIdParam: true },

    // ── employees ───────────────────────────────────────────────────────
    { method: "get", path: "/employees", tag: "Employees", summary: "List employees", auth: true, roles: ["PlatformAdmin", "TenantAdmin", "BranchManager"], query: employeeDtos.listEmployeesSchema },
    { method: "post", path: "/employees", tag: "Employees", summary: "Create a user and employee together", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], body: employeeDtos.createEmployeeSchema },
    { method: "get", path: "/employees/{id}", tag: "Employees", summary: "Get an employee", auth: true, roles: ["PlatformAdmin", "TenantAdmin", "BranchManager"], hasIdParam: true },
    { method: "patch", path: "/employees/{id}", tag: "Employees", summary: "Update an employee", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], hasIdParam: true, body: employeeDtos.updateEmployeeSchema },
    { method: "delete", path: "/employees/{id}", tag: "Employees", summary: "Soft-delete an employee", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], hasIdParam: true, query: employeeDtos.deleteEmployeeQuerySchema },

    // ── branches (BRANCHES_ENABLED=true only) ───────────────────────────
    { method: "get", path: "/branches", tag: "Branches", summary: "List branches", auth: true, query: branchDtos.listBranchesSchema },
    { method: "post", path: "/branches", tag: "Branches", summary: "Create a branch", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], body: branchDtos.createBranchSchema },
    { method: "get", path: "/branches/{id}", tag: "Branches", summary: "Get a branch", auth: true, hasIdParam: true },
    { method: "patch", path: "/branches/{id}", tag: "Branches", summary: "Update a branch", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], hasIdParam: true, body: branchDtos.updateBranchSchema },
    { method: "delete", path: "/branches/{id}", tag: "Branches", summary: "Soft-delete a branch", auth: true, roles: ["PlatformAdmin", "TenantAdmin"], hasIdParam: true },

    // ── tenants (TENANCY_MODE=multi only) ───────────────────────────────
    { method: "get", path: "/tenants", tag: "Tenants", summary: "List workspaces", auth: true, roles: ["PlatformAdmin"], query: tenantDtos.listTenantsSchema },
    { method: "post", path: "/tenants", tag: "Tenants", summary: "Create a workspace", auth: true, roles: ["PlatformAdmin"], body: tenantDtos.createTenantSchema },
    { method: "get", path: "/tenants/{id}", tag: "Tenants", summary: "Get a workspace", auth: true, roles: ["PlatformAdmin"], hasIdParam: true },
    { method: "patch", path: "/tenants/{id}", tag: "Tenants", summary: "Update a workspace", auth: true, roles: ["PlatformAdmin"], hasIdParam: true, body: tenantDtos.updateTenantSchema },
    { method: "delete", path: "/tenants/{id}", tag: "Tenants", summary: "Soft-delete a workspace", auth: true, roles: ["PlatformAdmin"], hasIdParam: true },
];

/** Flattens a Zod object schema into individual query parameters. */
function queryParameters(schema: z.ZodType): unknown[] {
    const json = toSchema(schema);
    const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
    const required = new Set((json.required as string[] | undefined) ?? []);

    return Object.entries(properties).map(([name, propertySchema]) => ({
        name,
        in: "query",
        required: required.has(name),
        schema: propertySchema,
        ...(propertySchema.description ? { description: propertySchema.description } : {}),
    }));
}

function buildDocument() {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const endpoint of endpoints) {
        const path = `${API_PREFIX}${endpoint.path}`;
        paths[path] ??= {};

        const parameters: unknown[] = [];
        if (endpoint.hasIdParam) {
            parameters.push({
                name: "id",
                in: "path",
                required: true,
                schema: { type: "string", format: "uuid" },
            });
        }
        if (endpoint.query) parameters.push(...queryParameters(endpoint.query));

        paths[path][endpoint.method] = {
            tags: [endpoint.tag],
            summary: endpoint.summary,
            ...(endpoint.roles
                ? { description: `Requires one of: ${endpoint.roles.join(", ")}.` }
                : {}),
            ...(endpoint.auth ? { security: [{ bearerAuth: [] }] } : { security: [] }),
            ...(parameters.length > 0 ? { parameters } : {}),
            ...(endpoint.body
                ? {
                      requestBody: {
                          required: true,
                          content: { "application/json": { schema: toSchema(endpoint.body) } },
                      },
                  }
                : {}),
            responses: {
                "200": { $ref: "#/components/responses/Success" },
                "400": { $ref: "#/components/responses/Error" },
                "401": { $ref: "#/components/responses/Error" },
                "403": { $ref: "#/components/responses/Error" },
                "404": { $ref: "#/components/responses/Error" },
                "409": { $ref: "#/components/responses/Error" },
                "429": { $ref: "#/components/responses/Error" },
            },
        };
    }

    return {
        openapi: "3.1.0",
        info: {
            title: "Clean Architecture API",
            version: "1.0.0",
            description:
                "Generated from the Zod request schemas — do not edit by hand.\n\n" +
                "Every response uses one envelope: `{ status, data }` on success and " +
                "`{ status, error: { code, message, issues? }, requestId }` on failure. " +
                "Clients should branch on `error.code`, which is stable, never on `message`.\n\n" +
                "`/branches` exists only when BRANCHES_ENABLED=true; `/tenants` only when " +
                "TENANCY_MODE=multi.",
        },
        servers: [{ url: "http://localhost:3000", description: "Local development" }],
        tags: [...new Set(endpoints.map((e) => e.tag))].map((name) => ({ name })),
        components: {
            securitySchemes: {
                bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            },
            responses: {
                Success: {
                    description: "Success",
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    status: { const: "success" },
                                    message: { type: "string" },
                                    data: {},
                                    pagination: { $ref: "#/components/schemas/Pagination" },
                                },
                                required: ["status", "data"],
                            },
                        },
                    },
                },
                Error: {
                    description: "Error",
                    content: {
                        "application/json": {
                            schema: { $ref: "#/components/schemas/ErrorBody" },
                        },
                    },
                },
            },
            schemas: {
                Pagination: {
                    type: "object",
                    properties: {
                        page: { type: "integer" },
                        limit: { type: "integer" },
                        total: { type: "integer" },
                        totalPages: { type: "integer" },
                        hasNext: { type: "boolean" },
                        hasPrev: { type: "boolean" },
                    },
                },
                ErrorBody: {
                    type: "object",
                    properties: {
                        status: { const: "error" },
                        requestId: { type: "string" },
                        error: {
                            type: "object",
                            properties: {
                                code: { type: "string" },
                                message: { type: "string" },
                                issues: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            field: { type: "string" },
                                            message: { type: "string" },
                                        },
                                    },
                                },
                            },
                            required: ["code", "message"],
                        },
                    },
                    required: ["status", "error"],
                },
            },
        },
        paths,
    };
}

const outputPath = resolve(process.cwd(), "docs/openapi.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(buildDocument(), null, 2)}\n`);

process.stdout.write(`OpenAPI spec written to ${outputPath}\n`);
