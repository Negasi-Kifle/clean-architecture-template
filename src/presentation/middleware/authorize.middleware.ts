import type { NextFunction, Request, RequestHandler, Response } from "express";
import {
    ForbiddenError,
    PasswordChangeRequiredError,
    UnauthenticatedError,
} from "../../domain/errors";
import { UserRole } from "../../domain/enums";
import type { IIdentityRepository } from "../../domain/repositories";
import { runCrossTenant } from "../../shared/request-context";

/**
 * Restricts a route to the listed roles.
 *
 * Unknown role names throw AT STARTUP, not at request time. The alternative —
 * silently ignoring a typo — produces a route that either denies everyone
 * forever or, worse, ends up with an empty allow-list that some
 * implementations treat as "allow all". A typo should break the boot, loudly.
 */
export function authorize(...allowed: UserRole[]): RequestHandler {
    if (allowed.length === 0) {
        throw new Error("authorize() requires at least one role");
    }

    const known = new Set<string>(Object.values(UserRole));
    for (const role of allowed) {
        if (!known.has(role)) {
            throw new Error(
                `authorize() received an unknown role: "${role}". ` +
                    `Valid roles: ${Object.values(UserRole).join(", ")}`,
            );
        }
    }

    const allowedSet = new Set(allowed);

    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.principal) return next(new UnauthenticatedError());

        const permitted = req.principal.roles.some((role) => allowedSet.has(role as UserRole));
        if (!permitted) return next(new ForbiddenError());

        next();
    };
}

/**
 * Blocks every route except the password-change endpoint while a user is
 * flagged `mustChangePassword`.
 *
 * Without this, "must change password" is advisory: a client that simply skips
 * the prompt keeps using the temporary password indefinitely.
 */
export function enforcePasswordChange(identityRepository: IIdentityRepository): RequestHandler {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.principal) return next();

            const user = await runCrossTenant(() =>
                identityRepository.findById(req.principal!.userId),
            );
            if (user?.mustChangePassword) throw new PasswordChangeRequiredError();

            next();
        } catch (error) {
            next(error);
        }
    };
}
