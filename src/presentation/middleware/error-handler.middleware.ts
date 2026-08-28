import type { ErrorRequestHandler, NextFunction, Request, Response } from "express";
import {
    AccountInactiveError,
    BusinessRuleError,
    ConflictError,
    DomainError,
    ForbiddenError,
    InvalidCredentialsError,
    InvalidRefreshTokenError,
    MissingTenantScopeError,
    NotFoundError,
    PasswordChangeRequiredError,
    RefreshTokenReuseDetectedError,
    TenantResolutionError,
    UnauthenticatedError,
    ValidationError,
} from "../../domain/errors";
import { HttpStatus } from "../../shared/http-status";
import { logger } from "../../shared/logger";
import { config } from "../../config";

/**
 * The single place where a domain error becomes an HTTP response.
 *
 * A lookup table rather than a chain of `instanceof` branches: adding an error
 * type is one line, the mapping is inspectable, and there is no chance of an
 * ordering bug where a subclass is caught by its parent's branch first.
 */
const STATUS_BY_ERROR: ReadonlyArray<[new (...args: never[]) => DomainError, number]> = [
    [ValidationError, HttpStatus.BAD_REQUEST],
    [NotFoundError, HttpStatus.NOT_FOUND],
    [ConflictError, HttpStatus.CONFLICT],
    [BusinessRuleError, HttpStatus.UNPROCESSABLE_ENTITY],
    [UnauthenticatedError, HttpStatus.UNAUTHORIZED],
    [InvalidCredentialsError, HttpStatus.UNAUTHORIZED],
    [InvalidRefreshTokenError, HttpStatus.UNAUTHORIZED],
    [RefreshTokenReuseDetectedError, HttpStatus.UNAUTHORIZED],
    [AccountInactiveError, HttpStatus.FORBIDDEN],
    [ForbiddenError, HttpStatus.FORBIDDEN],
    [PasswordChangeRequiredError, HttpStatus.FORBIDDEN],
    [TenantResolutionError, HttpStatus.FORBIDDEN],
    [MissingTenantScopeError, HttpStatus.INTERNAL_SERVER_ERROR],
];

function statusFor(error: DomainError): number {
    for (const [ErrorClass, status] of STATUS_BY_ERROR) {
        if (error instanceof ErrorClass) return status;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
}

interface ErrorBody {
    status: "error";
    error: {
        code: string;
        message: string;
        issues?: Array<{ field: string; message: string }>;
    };
    requestId?: string;
    stack?: string;
}

export const errorHandler: ErrorRequestHandler = (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    // Headers already flushed — the response is committed and anything written
    // now would corrupt it. Hand it to Express, which destroys the socket.
    if (res.headersSent) {
        logger.error({ err: error }, "Error raised after response headers were sent");
        next(error);
        return;
    }

    const isDomainError = error instanceof DomainError;
    const status = isDomainError ? statusFor(error) : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
        logger.error({ err: error, path: req.path, method: req.method }, "Unhandled server error");
    } else {
        logger.debug(
            { err: error, path: req.path, method: req.method, status },
            "Request rejected",
        );
    }

    const body: ErrorBody = {
        status: "error",
        error: {
            code: isDomainError ? error.code : "INTERNAL_ERROR",
            // A 500 message is never echoed back: it may contain a query, a
            // connection string or a file path.
            message:
                status >= 500
                    ? "An unexpected error occurred"
                    : ((error as Error).message ?? "Request failed"),
            ...(error instanceof ValidationError && error.issues.length > 0
                ? { issues: error.issues }
                : {}),
        },
        requestId: req.requestId,
    };

    if (!config.isProduction && error instanceof Error && error.stack) {
        body.stack = error.stack;
    }

    res.status(status).json(body);
};
