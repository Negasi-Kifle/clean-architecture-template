import { Router, type RequestHandler } from "express";
import type { AuthController } from "../controllers";
import {
    changePasswordSchema,
    forgotPasswordSchema,
    loginSchema,
    logoutSchema,
    refreshTokenSchema,
    resetPasswordSchema,
    verifyResetTokenSchema,
} from "../DTOs/request/auth";
import { validateBody, validateQuery } from "../validators";

export interface AuthRouterDependencies {
    controller: AuthController;
    authenticate: RequestHandler;
    authLimiter: RequestHandler;
}

/**
 * `/auth`
 *
 * Every unauthenticated endpoint here is behind the tight auth rate limiter.
 * These are the endpoints an attacker can hit without credentials, so they are
 * the ones worth limiting hardest.
 *
 * `/change-password` deliberately skips `enforcePasswordChange` — a user who
 * must change their password has to be able to reach the endpoint that lets
 * them do it.
 */
export function buildAuthRouter(deps: AuthRouterDependencies): Router {
    const router = Router();
    const { controller, authenticate, authLimiter } = deps;

    router.post("/login", authLimiter, validateBody(loginSchema), controller.login);
    router.post("/refresh", authLimiter, validateBody(refreshTokenSchema), controller.refresh);
    router.post("/logout", validateBody(logoutSchema), controller.logout);

    router.post(
        "/forgot-password",
        authLimiter,
        validateBody(forgotPasswordSchema),
        controller.forgotPassword,
    );
    router.post(
        "/reset-password",
        authLimiter,
        validateBody(resetPasswordSchema),
        controller.resetPassword,
    );
    router.get(
        "/verify-reset-token",
        authLimiter,
        validateQuery(verifyResetTokenSchema),
        controller.verifyResetToken,
    );

    router.post(
        "/change-password",
        authenticate,
        validateBody(changePasswordSchema),
        controller.changePassword,
    );
    router.post("/logout-all", authenticate, controller.logoutAll);
    router.get("/me", authenticate, controller.me);
    router.get("/sessions", authenticate, controller.sessions);

    return router;
}
