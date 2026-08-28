import type { Request, Response } from "express";
import type {
    CreateEmployeeUseCase,
    DeleteEmployeeUseCase,
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    UpdateEmployeeUseCase,
} from "../../application/use-cases/employees";
import { mapPaginated } from "../../application/paginate";
import type {
    CreateEmployeeDto,
    DeleteEmployeeQueryDto,
    ListEmployeesDto,
    UpdateEmployeeDto,
} from "../DTOs/request/employees";
import type { UuidParam } from "../DTOs/request/common.dto";
import { toEmployeeResponse, toUserResponse } from "../DTOs/response";
import { getValidated } from "../validators";
import { requirePrincipal } from "../middleware";
import { toEmployeeQueryOptions } from "../mappers";
import { created, noContent, ok, paginated } from "../response";

export class EmployeeController {
    constructor(
        private readonly createEmployeeUseCase: CreateEmployeeUseCase,
        private readonly listEmployeesUseCase: ListEmployeesUseCase,
        private readonly getEmployeeUseCase: GetEmployeeUseCase,
        private readonly updateEmployeeUseCase: UpdateEmployeeUseCase,
        private readonly deleteEmployeeUseCase: DeleteEmployeeUseCase,
    ) {}

    create = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<CreateEmployeeDto>(res, "body");
        const result = await this.createEmployeeUseCase.execute(principal, body);

        created(
            res,
            {
                employee: toEmployeeResponse(result.employee),
                user: toUserResponse(result.user),
                // Present only when the API generated the password. This is
                // the one and only time it is ever returned.
                ...(result.generatedPassword
                    ? { generatedPassword: result.generatedPassword }
                    : {}),
            },
            result.generatedPassword
                ? "Employee created. Share the temporary password securely — it will not be shown again."
                : "Employee created",
        );
    };

    list = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<ListEmployeesDto>(res, "query");
        const result = await this.listEmployeesUseCase.execute(toEmployeeQueryOptions(query));
        paginated(res, mapPaginated(result, toEmployeeResponse));
    };

    getById = async (_req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<UuidParam>(res, "params");
        ok(res, toEmployeeResponse(await this.getEmployeeUseCase.execute(id)));
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        // From res.locals, NOT req.body. Reading req.body here would bypass
        // the validator entirely and hand unvalidated input to the use case.
        const body = getValidated<UpdateEmployeeDto>(res, "body");
        const employee = await this.updateEmployeeUseCase.execute(principal, id, body);
        ok(res, toEmployeeResponse(employee), "Employee updated");
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        const query = getValidated<DeleteEmployeeQueryDto>(res, "query");
        await this.deleteEmployeeUseCase.execute(principal, id, {
            deactivateUser: query.deactivateUser,
        });
        noContent(res);
    };
}
