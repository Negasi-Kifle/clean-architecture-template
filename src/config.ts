import "dotenv/config";
import { z } from "zod";

/**
 * Environment configuration, parsed and validated ONCE at process start.
 *
 * Two deliberate choices:
 *
 * 1. It is a Zod schema, not a pile of `process.env.X ?? default` reads. A
 *    typo'd or missing variable fails at boot with a precise message instead
 *    of surfacing as `undefined` three layers deep at 2am.
 *
 * 2. Production requirements are expressed in the same schema via superRefine,
 *    so there is exactly one place that answers "what must be set to deploy?".
 */

const booleanFromEnv = z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1");

const csv = z.string().transform((value) =>
    value
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part.length > 0),
);

const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        PORT: z.coerce.number().int().positive().default(3000),
        LOG_LEVEL: z
            .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
            .optional(),

        DATABASE_URL: z
            .string()
            .min(1, "DATABASE_URL is required")
            .refine(
                (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
                "DATABASE_URL must be a postgres:// or postgresql:// connection string",
            ),

        TENANCY_MODE: z.enum(["single", "multi"]).default("single"),
        DEFAULT_TENANT_SLUG: z.string().min(1).default("default"),
        BRANCHES_ENABLED: booleanFromEnv.default(true),

        JWT_SECRET: z.string().default(""),
        JWT_ISSUER: z.string().min(1).default("clean-architecture-api"),
        JWT_AUDIENCE: z.string().min(1).default("clean-architecture-api"),
        ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
        REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
        PASSWORD_RESET_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
        PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(8),
        BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
        DEFAULT_EMPLOYEE_PASSWORD: z.string().optional(),

        CORS_ORIGINS: csv.prefault("*"),
        TRUST_PROXY: booleanFromEnv.default(false),
        RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
        RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
        AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

        BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
        BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
        BOOTSTRAP_ADMIN_PHONE: z.string().optional(),

        SMTP_HOST: z.string().optional(),
        SMTP_PORT: z.coerce.number().int().positive().default(587),
        SMTP_SECURE: booleanFromEnv.default(false),
        SMTP_USER: z.string().optional(),
        SMTP_PASSWORD: z.string().optional(),
        EMAIL_FROM: z.string().default("no-reply@example.com"),
        EMAIL_FROM_NAME: z.string().default("Example App"),
        CLIENT_URL: z.string().default(""),
    })
    .superRefine((env, ctx) => {
        if (env.NODE_ENV !== "production") return;

        if (env.JWT_SECRET.trim().length < 32) {
            ctx.addIssue({
                code: "custom",
                path: ["JWT_SECRET"],
                message:
                    "JWT_SECRET must be at least 32 characters in production. " +
                    "Generate one with: openssl rand -base64 48",
            });
        }
        if (env.CORS_ORIGINS.includes("*")) {
            ctx.addIssue({
                code: "custom",
                path: ["CORS_ORIGINS"],
                message: "CORS_ORIGINS must not be '*' in production. List the real origins.",
            });
        }
        if (!env.CLIENT_URL.trim()) {
            ctx.addIssue({
                code: "custom",
                path: ["CLIENT_URL"],
                message: "CLIENT_URL is required in production (password-reset links point at it).",
            });
        }
    });

function loadConfig() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
        const details = parsed.error.issues
            .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join("\n");
        throw new Error(`Invalid environment configuration:\n${details}`);
    }

    const env = parsed.data;

    const jwtSecret = env.JWT_SECRET.trim()
        ? env.JWT_SECRET.trim()
        : // Non-production only: superRefine above rejects a weak secret in prod.
          "development-only-insecure-jwt-secret-do-not-ship-this";

    return {
        nodeEnv: env.NODE_ENV,
        isProduction: env.NODE_ENV === "production",
        isTest: env.NODE_ENV === "test",
        port: env.PORT,
        logLevel: env.LOG_LEVEL,

        databaseUrl: env.DATABASE_URL,

        tenancy: {
            mode: env.TENANCY_MODE,
            isMulti: env.TENANCY_MODE === "multi",
            defaultTenantSlug: env.DEFAULT_TENANT_SLUG,
            /** Reserved tenant that holds PlatformAdmin accounts. Never a customer tenant. */
            systemTenantSlug: "__platform__",
        },

        features: {
            branchesEnabled: env.BRANCHES_ENABLED,
        },

        auth: {
            jwtSecret,
            issuer: env.JWT_ISSUER,
            audience: env.JWT_AUDIENCE,
            accessTokenTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
            refreshTokenTtlSeconds: env.REFRESH_TOKEN_TTL_SECONDS,
            passwordResetTtlSeconds: env.PASSWORD_RESET_TTL_SECONDS,
            passwordMinLength: env.PASSWORD_MIN_LENGTH,
            bcryptCost: env.BCRYPT_COST,
            defaultEmployeePassword: env.DEFAULT_EMPLOYEE_PASSWORD?.trim() || undefined,
        },

        http: {
            corsOrigins: env.CORS_ORIGINS,
            trustProxy: env.TRUST_PROXY,
            rateLimit: {
                windowMs: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
                max: env.RATE_LIMIT_MAX,
                authMax: env.AUTH_RATE_LIMIT_MAX,
            },
        },

        bootstrap: {
            adminEmail: env.BOOTSTRAP_ADMIN_EMAIL,
            adminPassword: env.BOOTSTRAP_ADMIN_PASSWORD,
            adminPhone: env.BOOTSTRAP_ADMIN_PHONE,
        },

        mail: {
            enabled: Boolean(env.SMTP_HOST?.trim()),
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            user: env.SMTP_USER,
            password: env.SMTP_PASSWORD,
            from: env.EMAIL_FROM,
            fromName: env.EMAIL_FROM_NAME,
        },

        clientUrl: env.CLIENT_URL.replace(/\/$/, ""),
    } as const;
}

export type AppConfig = ReturnType<typeof loadConfig>;

export const config: AppConfig = loadConfig();
