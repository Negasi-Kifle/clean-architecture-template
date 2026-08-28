import { Router, type RequestHandler } from "express";
import type { TenantController } from "../controllers";
import { UserRole } from "../../domain/enums";
import { createTenantSchema, listTenantsSchema, updateTenantSchema } from "../DTOs/request/tenants";
import { uuidParam } from "../DTOs/request/common.dto";
import { authorize } from "../middleware";
import { validateBody, validateParams, validateQuery } from "../validators";

export interface TenantRouterDependencies {
    controller: TenantController;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
}

/**
 * `/tenants` — platform administration.
 *
 * Mounted only when TENANCY_MODE=multi. In single-tenant mode these endpoints
 * do not exist at all, so there is no surface for creating a second workspace
 * in a product that assumes one.
 */
export function buildTenantRouter(deps: TenantRouterDependencies): Router {
    const router = Router();
    const { controller, authenticate, enforcePasswordChange } = deps;

    const platformAdmin = authorize(UserRole.PlatformAdmin);

    router.use(authenticate, enforcePasswordChange, platformAdmin);

    router
        .route("/")
        .get(validateQuery(listTenantsSchema), controller.list)
        .post(validateBody(createTenantSchema), controller.create);

    router
        .route("/:id")
        .get(validateParams(uuidParam), controller.getById)
        .patch(validateParams(uuidParam), validateBody(updateTenantSchema), controller.update)
        .delete(validateParams(uuidParam), controller.delete);

    return router;
}
