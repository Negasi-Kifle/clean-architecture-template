import { Router, type RequestHandler } from "express";
import type { UserController } from "../controllers";
import { UserRole } from "../../domain/enums";
import {
    createUserSchema,
    listUsersSchema,
    updateMeSchema,
    updateUserSchema,
} from "../DTOs/request/users";
import { uuidParam } from "../DTOs/request/common.dto";
import { authorize } from "../middleware";
import { validateBody, validateParams, validateQuery } from "../validators";

export interface UserRouterDependencies {
    controller: UserController;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
}

export function buildUserRouter(deps: UserRouterDependencies): Router {
    const router = Router();
    const { controller, authenticate, enforcePasswordChange } = deps;

    router.use(authenticate, enforcePasswordChange);

    // `/me` is declared before `/:id` — otherwise Express matches "me" as an
    // id and the UUID param validator rejects it with a confusing 400.
    router.patch("/me", validateBody(updateMeSchema), controller.updateMe);

    router
        .route("/")
        .get(
            authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin),
            validateQuery(listUsersSchema),
            controller.list,
        )
        .post(
            authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin),
            validateBody(createUserSchema),
            controller.create,
        );

    router
        .route("/:id")
        // No `authorize` here: the use case allows a user to read or edit
        // their own record, which a role check at the route cannot express.
        .get(validateParams(uuidParam), controller.getById)
        .patch(validateParams(uuidParam), validateBody(updateUserSchema), controller.update)
        .delete(
            authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin),
            validateParams(uuidParam),
            controller.delete,
        );

    return router;
}
