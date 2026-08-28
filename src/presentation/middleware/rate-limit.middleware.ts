import rateLimit, { ipKeyGenerator, type RateLimitRequestHandler } from "express-rate-limit";
import type { Request } from "express";
import { HttpStatus } from "../../shared/http-status";

export interface RateLimitOptions {
    windowMs: number;
    max: number;
}

function payload(message: string) {
    return {
        status: "error" as const,
        error: { code: "RATE_LIMITED", message },
    };
}

/** Baseline limiter for the whole API. */
export function globalRateLimit(options: RateLimitOptions): RateLimitRequestHandler {
    return rateLimit({
        windowMs: options.windowMs,
        limit: options.max,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: payload("Too many requests. Please slow down."),
        // Authenticated traffic is limited per user, so one busy client on a
        // shared office IP cannot exhaust the budget for their colleagues.
        keyGenerator: (req: Request) =>
            req.principal?.userId ?? ipKeyGenerator(req.ip ?? "unknown"),
    });
}

/**
 * Tight limiter for credential endpoints.
 *
 * Keyed on IP *and* the submitted identifier: keying on IP alone lets a
 * distributed attacker spread guesses across addresses, while keying on the
 * identifier alone lets anyone lock a known account out by burning its budget.
 * Requiring both to repeat is what actually slows credential stuffing.
 */
export function authRateLimit(options: RateLimitOptions): RateLimitRequestHandler {
    return rateLimit({
        windowMs: options.windowMs,
        limit: options.max,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        message: payload("Too many attempts. Please try again later."),
        skipSuccessfulRequests: true,
        keyGenerator: (req: Request) => {
            const body = req.body as { identifier?: unknown; email?: unknown } | undefined;
            const raw = body?.identifier ?? body?.email;
            const identifier =
                typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 128) : "";
            return `${ipKeyGenerator(req.ip ?? "unknown")}:${identifier}`;
        },
    });
}
