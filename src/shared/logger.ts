import pino from "pino";
import { getContext } from "./request-context";

const isProduction = process.env.NODE_ENV === "production";
// pino-pretty runs in a worker thread. That thread keeps the event loop alive,
// which makes Jest hang after the last test, so tests get the plain JSON
// logger (silenced by LOG_LEVEL) instead.
const isTest = process.env.NODE_ENV === "test";

/**
 * Structured logger.
 *
 * `requestId` and `tenantId` are attached automatically from the ambient
 * request context, so no call site has to remember to pass them, and every
 * line emitted while handling a request is correlatable.
 */
export const logger = pino({
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    // Never let a stack trace or a config dump leak a credential.
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "*.password",
            "*.passwordHash",
            "*.newPassword",
            "*.currentPassword",
            "*.refreshToken",
            "*.accessToken",
            "*.token",
        ],
        censor: "[redacted]",
    },
    mixin() {
        const context = getContext();
        if (!context) return {};
        return {
            requestId: context.requestId,
            ...(context.tenantId ? { tenantId: context.tenantId } : {}),
            ...(context.userId ? { userId: context.userId } : {}),
        };
    },
    ...(isProduction || isTest
        ? {}
        : {
              transport: {
                  target: "pino-pretty",
                  options: { colorize: true, translateTime: "HH:MM:ss.l", ignore: "pid,hostname" },
              },
          }),
});

export type Logger = typeof logger;
