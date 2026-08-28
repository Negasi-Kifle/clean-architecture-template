/**
 * Environment defaults for the test run.
 *
 * `src/config.ts` validates the whole environment at import time and throws on
 * anything missing — which is exactly what you want in production, and exactly
 * what breaks a unit test that happens to import a DTO. Setting the minimum
 * here keeps that strictness without making every test carry an env file.
 *
 * Values already present win, so `TEST_DATABASE_URL` from CI or a local .env
 * still drives the integration tests.
 */
const defaults: Record<string, string> = {
    NODE_ENV: "test",
    DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5433/app_test?schema=public",
    JWT_SECRET: "test-only-secret-at-least-32-characters-long",
    LOG_LEVEL: "silent",
    TENANCY_MODE: "multi",
    BRANCHES_ENABLED: "true",
    CLIENT_URL: "http://localhost:5173",
    CORS_ORIGINS: "*",
};

for (const [key, value] of Object.entries(defaults)) {
    process.env[key] ??= value;
}
