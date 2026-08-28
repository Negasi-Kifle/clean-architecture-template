import { randomUUID } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { runWithContext } from "../../shared/request-context";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Opens the ambient request context and stamps a request id.
 *
 * Must be the FIRST middleware. Everything downstream — the logger, the tenant
 * scope on every query, the error handler — reads from the store this opens.
 *
 * An inbound `x-request-id` is honoured so a trace started at the load
 * balancer or an upstream service stays one trace, but it is length-capped and
 * sanitised: it ends up in log lines, and an unbounded header value is a log
 * injection vector.
 */
export function requestContext(): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        const inbound = req.headers[REQUEST_ID_HEADER];
        const candidate = Array.isArray(inbound) ? inbound[0] : inbound;
        const requestId = sanitizeRequestId(candidate) ?? randomUUID();

        req.requestId = requestId;
        res.setHeader(REQUEST_ID_HEADER, requestId);

        runWithContext({ requestId, crossTenant: false }, () => next());
    };
}

function sanitizeRequestId(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const cleaned = value.replace(/[^\w.-]/g, "").slice(0, 64);
    return cleaned.length > 0 ? cleaned : undefined;
}
