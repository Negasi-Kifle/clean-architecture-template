import type { Request, Response } from "express";
import type {
    CreateTenantUseCase,
    DeleteTenantUseCase,
    GetTenantUseCase,
    ListTenantsUseCase,
    UpdateTenantUseCase,
} from "../../application/use-cases/tenants";
import { mapPaginated } from "../../application/paginate";
import type { CreateTenantDto, ListTenantsDto, UpdateTenantDto } from "../DTOs/request/tenants";
import type { UuidParam } from "../DTOs/request/common.dto";
import { toTenantResponse, toUserResponse } from "../DTOs/response";
import { getValidated } from "../validators";
import { requirePrincipal } from "../middleware";
import { toTenantQueryOptions } from "../mappers";
import { created, noContent, ok, paginated } from "../response";

/** Mounted only when TENANCY_MODE=multi. */
export class TenantController {
    constructor(
        private readonly createTenantUseCase: CreateTenantUseCase,
        private readonly listTenantsUseCase: ListTenantsUseCase,
        private readonly getTenantUseCase: GetTenantUseCase,
        private readonly updateTenantUseCase: UpdateTenantUseCase,
        private readonly deleteTenantUseCase: DeleteTenantUseCase,
    ) {}

    create = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<CreateTenantDto>(res, "body");
        const result = await this.createTenantUseCase.execute(principal, body);
        created(
            res,
            {
                tenant: toTenantResponse(result.tenant),
                ...(result.admin ? { admin: toUserResponse(result.admin) } : {}),
            },
            "Workspace created",
        );
    };

    list = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const query = getValidated<ListTenantsDto>(res, "query");
        const result = await this.listTenantsUseCase.execute(
            principal,
            toTenantQueryOptions(query),
        );
        paginated(res, mapPaginated(result, toTenantResponse));
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        ok(res, toTenantResponse(await this.getTenantUseCase.execute(principal, id)));
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        const body = getValidated<UpdateTenantDto>(res, "body");
        ok(
            res,
            toTenantResponse(await this.updateTenantUseCase.execute(principal, id, body)),
            "Workspace updated",
        );
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        await this.deleteTenantUseCase.execute(principal, id);
        noContent(res);
    };
}
