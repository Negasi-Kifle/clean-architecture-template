import { Router, type RequestHandler } from "express";
import type {
    AuthController,
    BranchController,
    EmployeeController,
    TenantController,
    UserController,
} from "../controllers";
import { buildAuthRouter } from "./auth.routes";
import { buildBranchRouter } from "./branch.routes";
import { buildEmployeeRouter } from "./employee.routes";
import { buildTenantRouter } from "./tenant.routes";
import { buildUserRouter } from "./user.routes";
import { logger } from "../../shared/logger";

export interface RouteControllers {
    auth: AuthController;
    user: UserController;
    employee: EmployeeController;
    /** Present only when BRANCHES_ENABLED=true. */
    branch?: BranchController;
    /** Present only when TENANCY_MODE=multi. */
    tenant?: TenantController;
}

export interface RootRouterDependencies {
    controllers: RouteControllers;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
    authLimiter: RequestHandler;
    features: {
        branchesEnabled: boolean;
        multiTenant: boolean;
    };
}

/**
 * Mounts every domain router under `/api/v1`.
 *
 * Feature-gated routers are not mounted at all rather than mounted and
 * guarded. A disabled feature should have no HTTP surface: nothing to
 * authorize, nothing to fuzz, and nothing that returns a confusing 403 instead
 * of an honest 404.
 */
export function buildRootRouter(deps: RootRouterDependencies): Router {
    const router = Router();
    const { controllers, authenticate, enforcePasswordChange, authLimiter, features } = deps;

    router.use(
        "/auth",
        buildAuthRouter({ controller: controllers.auth, authenticate, authLimiter }),
    );
    router.use(
        "/users",
        buildUserRouter({ controller: controllers.user, authenticate, enforcePasswordChange }),
    );
    router.use(
        "/employees",
        buildEmployeeRouter({
            controller: controllers.employee,
            authenticate,
            enforcePasswordChange,
        }),
    );

    if (features.branchesEnabled && controllers.branch) {
        router.use(
            "/branches",
            buildBranchRouter({
                controller: controllers.branch,
                authenticate,
                enforcePasswordChange,
            }),
        );
    } else {
        logger.info("BRANCHES_ENABLED=false — /branches routes are not mounted");
    }

    if (features.multiTenant && controllers.tenant) {
        router.use(
            "/tenants",
            buildTenantRouter({
                controller: controllers.tenant,
                authenticate,
                enforcePasswordChange,
            }),
        );
    } else {
        logger.info("TENANCY_MODE=single — /tenants routes are not mounted");
    }

    return router;
}
