import type { RequestHandler } from "express";
import { config } from "../config";
import { authenticate, authRateLimit, enforcePasswordChange } from "../presentation/middleware";
import type { RouteControllers } from "../presentation/routes";
import { buildSharedInfra } from "./shared-infra";
import { buildAuthModule } from "./auth.module";
import { buildUserModule } from "./user.module";
import { buildEmployeeModule } from "./employee.module";
import { buildBranchModule } from "./branch.module";
import { buildTenantModule } from "./tenant.module";

export interface Container {
    controllers: RouteControllers;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
    authLimiter: RequestHandler;
}

/**
 * The composition root — the ONE place that knows about concrete classes.
 *
 * Everything else programs against the interfaces in `domain/`. That is what
 * makes a use case testable with a hand-written fake instead of a running
 * Postgres, and what lets bcrypt become argon2, or Prisma become something
 * else, without any file outside `infrastructure/` changing.
 *
 * TO ADD A DOMAIN:
 *   1. `src/composition/<domain>.module.ts` exporting `build<Domain>Module`.
 *   2. Add it to the `controllers` object below.
 *   3. Add the field to `RouteControllers` and mount its router in
 *      `src/presentation/routes/index.ts`.
 *   `npm run generate:module` does all three.
 */
export function buildContainer(): Container {
    const infra = buildSharedInfra();

    const controllers: RouteControllers = {
        auth: buildAuthModule(infra).controller,
        user: buildUserModule(infra).controller,
        employee: buildEmployeeModule(infra).controller,
        // Built only when the feature is on: a module that is not mounted
        // should not be constructed, connected or held in memory.
        ...(config.features.branchesEnabled ? { branch: buildBranchModule().controller } : {}),
        ...(config.tenancy.isMulti ? { tenant: buildTenantModule(infra).controller } : {}),
    };

    return {
        controllers,
        authenticate: authenticate({
            tokenService: infra.tokenService,
            identityRepository: infra.identityRepository,
        }),
        enforcePasswordChange: enforcePasswordChange(infra.identityRepository),
        authLimiter: authRateLimit({
            windowMs: config.http.rateLimit.windowMs,
            max: config.http.rateLimit.authMax,
        }),
    };
}
