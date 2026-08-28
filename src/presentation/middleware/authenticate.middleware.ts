import type { NextFunction, Request, RequestHandler, Response } from "express";
import { UnauthenticatedError } from "../../domain/errors";
import type { IIdentityRepository } from "../../domain/repositories";
import type { ITokenService } from "../../domain/services";
import { runCrossTenant, runWithContext } from "../../shared/request-context";

const BEARER = /^Bearer\s+(.+)$/i;

export interface AuthenticateDependencies {
    tokenService: ITokenService;
    identityRepository: IIdentityRepository;
}

/**
 * Verifies the bearer token and opens the tenant scope for the rest of the
 * request.
 *
 * The database round trip is deliberate. A signed token proves who minted it,
 * not that the account still exists, is still active, or has not had its
 * credentials changed since. Trusting the signature alone means a deactivated
 * employee keeps full access until their token happens to expire.
 *
 * With a 15-minute access token this is one indexed primary-key lookup per
 * request; if that ever becomes the bottleneck, cache the user by id with a
 * TTL shorter than the token lifetime — do not remove the check.
 */
export function authenticate(deps: AuthenticateDependencies): RequestHandler {
    return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
        try {
            const match = BEARER.exec(req.headers.authorization ?? "");
            const token = match?.[1]?.trim();
            if (!token) throw new UnauthenticatedError();

            const claims = await deps.tokenService.verifyAccessToken(token);

            // Cross-tenant by necessity: the tenant scope is not open yet —
            // this lookup is what establishes it.
            const user = await runCrossTenant(() => deps.identityRepository.findById(claims.sub));

            if (!user || !user.canAuthenticate()) throw new UnauthenticatedError();

            // The token's tenant must still be the user's tenant. They can only
            // differ if a token was minted before a move between tenants, or
            // if one was forged.
            if (user.tenantId !== claims.tenantId) throw new UnauthenticatedError();

            if (user.isTokenStale(claims.credentialsVersion)) {
                throw new UnauthenticatedError(
                    "Your credentials were changed. Please sign in again.",
                );
            }

            req.principal = {
                userId: user.id,
                tenantId: user.tenantId,
                // Roles come from the database, not the token: a role revoked
                // a minute ago must not survive in an access token that is
                // still within its lifetime.
                roles: [...user.roles],
                issuedAt: claims.issuedAt,
            };

            runWithContext(
                {
                    requestId: req.requestId,
                    tenantId: user.tenantId,
                    userId: user.id,
                    crossTenant: false,
                },
                () => next(),
            );
        } catch (error) {
            next(error);
        }
    };
}

/** Reads `req.principal`, or throws. Use inside handlers behind `authenticate`. */
export function requirePrincipal(req: Request) {
    if (!req.principal) throw new UnauthenticatedError();
    return req.principal;
}
