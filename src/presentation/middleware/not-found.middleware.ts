import type { NextFunction, Request, RequestHandler, Response } from "express";
import { NotFoundError } from "../../domain/errors";

/**
 * Terminal 404 for unmatched routes.
 *
 * Forwards a real `NotFoundError` rather than writing a response directly, so
 * unmatched routes and missing records produce the same envelope and the same
 * log line.
 */
export function notFoundHandler(): RequestHandler {
    return (req: Request, _res: Response, next: NextFunction): void => {
        next(new NotFoundError("Route", `${req.method} ${req.path}`));
    };
}
