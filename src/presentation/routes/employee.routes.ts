import { Router, type RequestHandler } from "express";
import type { EmployeeController } from "../controllers";
import { UserRole } from "../../domain/enums";
import {
    createEmployeeSchema,
    deleteEmployeeQuerySchema,
    listEmployeesSchema,
    updateEmployeeSchema,
} from "../DTOs/request/employees";
import { uuidParam } from "../DTOs/request/common.dto";
import { authorize } from "../middleware";
import { validateBody, validateParams, validateQuery } from "../validators";

export interface EmployeeRouterDependencies {
    controller: EmployeeController;
    authenticate: RequestHandler;
    enforcePasswordChange: RequestHandler;
}

export function buildEmployeeRouter(deps: EmployeeRouterDependencies): Router {
    const router = Router();
    const { controller, authenticate, enforcePasswordChange } = deps;

    const admin = authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin);
    const manager = authorize(UserRole.PlatformAdmin, UserRole.TenantAdmin, UserRole.BranchManager);

    router.use(authenticate, enforcePasswordChange);

    router
        .route("/")
        .get(manager, validateQuery(listEmployeesSchema), controller.list)
        .post(admin, validateBody(createEmployeeSchema), controller.create);

    router
        .route("/:id")
        .get(manager, validateParams(uuidParam), controller.getById)
        .patch(
            admin,
            validateParams(uuidParam),
            validateBody(updateEmployeeSchema),
            controller.update,
        )
        .delete(
            admin,
            validateParams(uuidParam),
            validateQuery(deleteEmployeeQuerySchema),
            controller.delete,
        );

    return router;
}
