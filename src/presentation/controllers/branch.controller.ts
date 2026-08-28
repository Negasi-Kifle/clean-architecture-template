import type { Request, Response } from "express";
import type {
    CreateBranchUseCase,
    DeleteBranchUseCase,
    GetBranchUseCase,
    ListBranchesUseCase,
    UpdateBranchUseCase,
} from "../../application/use-cases/branches";
import { mapPaginated } from "../../application/paginate";
import type { CreateBranchDto, ListBranchesDto, UpdateBranchDto } from "../DTOs/request/branches";
import type { UuidParam } from "../DTOs/request/common.dto";
import { toBranchResponse } from "../DTOs/response";
import { getValidated } from "../validators";
import { requirePrincipal } from "../middleware";
import { toBranchQueryOptions } from "../mappers";
import { created, noContent, ok, paginated } from "../response";

export class BranchController {
    constructor(
        private readonly createBranchUseCase: CreateBranchUseCase,
        private readonly listBranchesUseCase: ListBranchesUseCase,
        private readonly getBranchUseCase: GetBranchUseCase,
        private readonly updateBranchUseCase: UpdateBranchUseCase,
        private readonly deleteBranchUseCase: DeleteBranchUseCase,
    ) {}

    create = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<CreateBranchDto>(res, "body");
        created(
            res,
            toBranchResponse(await this.createBranchUseCase.execute(principal, body)),
            "Branch created",
        );
    };

    list = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<ListBranchesDto>(res, "query");
        const result = await this.listBranchesUseCase.execute(toBranchQueryOptions(query));
        paginated(res, mapPaginated(result, toBranchResponse));
    };

    getById = async (_req: Request, res: Response): Promise<void> => {
        const { id } = getValidated<UuidParam>(res, "params");
        ok(res, toBranchResponse(await this.getBranchUseCase.execute(id)));
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        const body = getValidated<UpdateBranchDto>(res, "body");
        ok(
            res,
            toBranchResponse(await this.updateBranchUseCase.execute(principal, id, body)),
            "Branch updated",
        );
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        await this.deleteBranchUseCase.execute(principal, id);
        noContent(res);
    };
}
