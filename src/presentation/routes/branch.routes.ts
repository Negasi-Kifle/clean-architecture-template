import { Router, type RequestHandler } from "express";
import type { BranchController } from "../controllers";
import { UserRole } from "../../domain/enums";
import {
    createBranchSchema,
    listBranchesSchema,
    updateBranchSchema,
} from "../DTOs/request/branches";
import { uuidParam } from "../DTOs/request/common.dto";
import { authorize } from "../middleware";
import { validateBody, validateParams, validateQuery } from "../validators";

export interface BranchRouterDependencies {
    controller: BranchController;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
}

/** Mounted only when BRANCHES_ENABLED=true. */
export function buildBranchRouter(deps: BranchRouterDependencies): Router {
    const router = Router();
    const { controller, authenticate, enforcePasswordChange } = deps;

    const admin = authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin);

    router.use(authenticate, enforcePasswordChange);

    router
        .route("/")
        // Any authenticated member may read the branch list — it is the
        // directory a staff app needs to render a picker.
        .get(validateQuery(listBranchesSchema), controller.list)
        .post(admin, validateBody(createBranchSchema), controller.create);

    router
        .route("/:id")
        .get(validateParams(uuidParam), controller.getById)
        .patch(
            admin,
            validateParams(uuidParam),
            validateBody(updateBranchSchema),
            controller.update,
        )
        .delete(admin, validateParams(uuidParam), controller.delete);

    return router;
}
