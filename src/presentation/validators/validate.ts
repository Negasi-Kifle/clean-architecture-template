import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType, ZodError } from "zod";
import { ValidationError, type FieldIssue } from "../../domain/errors";

/**
 * Zod validation for body, query and route params.
 *
 * Three things this fixes relative to the usual implementation:
 *
 * 1. One formatter for all three targets. Duplicated formatters drift, and
 *    then the same malformed input is reported differently depending on
 *    whether it arrived in the body or the query string.
 *
 * 2. Errors are FIELD-LEVEL. A joined sentence forces a frontend to parse
 *    prose in order to highlight the offending input.
 *
 * 3. `validateParams` exists. Without it `req.params.id` reaches the database
 *    unchecked, and a non-UUID surfaces as a raw driver error instead of a 400.
 */

type Target = "body" | "query" | "params";

function toFieldIssues(error: ZodError): FieldIssue[] {
    return error.issues.map((issue) => {
        if (issue.code === "unrecognized_keys") {
            return {
                field: issue.keys.join(", "),
                message: `Unexpected field(s): ${issue.keys.join(", ")}`,
            };
        }
        return {
            field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
            message: issue.message,
        };
    });
}

function validate(target: Target, schema: ZodType): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
        const source = target === "body" ? req.body : target === "query" ? req.query : req.params;
        const result = schema.safeParse(source);

        if (!result.success) {
            next(new ValidationError(`Invalid request ${target}`, toFieldIssues(result.error)));
            return;
        }

        // Parsed output goes to res.locals, never back onto req. In Express 5
        // `req.query` is a getter and cannot be reassigned, and mutating
        // `req.body` in place loses Zod's coercions and defaults.
        res.locals[target] = result.data;
        next();
    };
}

export const validateBody = (schema: ZodType): RequestHandler => validate("body", schema);
export const validateQuery = (schema: ZodType): RequestHandler => validate("query", schema);
export const validateParams = (schema: ZodType): RequestHandler => validate("params", schema);

/**
 * Reads validated data in a controller.
 *
 * Throws rather than returning undefined when the matching validator is not
 * mounted: a handler silently receiving `undefined` because someone forgot
 * `validateBody` on the route is a bug worth failing loudly on, in the first
 * test run rather than in production.
 */
export function getValidated<T>(res: Response, target: Target): T {
    const value = res.locals[target];
    if (value === undefined) {
        throw new Error(
            `res.locals.${target} is empty. Mount validate${
                target.charAt(0).toUpperCase() + target.slice(1)
            }() on this route before the controller.`,
        );
    }
    return value as T;
}
