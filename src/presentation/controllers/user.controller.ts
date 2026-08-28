import type { Request, Response } from "express";
import type {
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
} from "../../application/use-cases/users";
import { mapPaginated } from "../../application/paginate";
import type {
    CreateUserDto,
    ListUsersDto,
    UpdateMeDto,
    UpdateUserDto,
} from "../DTOs/request/users";
import type { UuidParam } from "../DTOs/request/common.dto";
import { toUserResponse } from "../DTOs/response";
import { getValidated } from "../validators";
import { requirePrincipal } from "../middleware";
import { toUserQueryOptions } from "../mappers";
import { created, noContent, ok, paginated } from "../response";

export class UserController {
    constructor(
        private readonly createUserUseCase: CreateUserUseCase,
        private readonly listUsersUseCase: ListUsersUseCase,
        private readonly getUserUseCase: GetUserUseCase,
        private readonly updateUserUseCase: UpdateUserUseCase,
        private readonly deleteUserUseCase: DeleteUserUseCase,
    ) {}

    create = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<CreateUserDto>(res, "body");
        const user = await this.createUserUseCase.execute(principal, body);
        created(res, toUserResponse(user), "User created");
    };

    list = async (_req: Request, res: Response): Promise<void> => {
        const query = getValidated<ListUsersDto>(res, "query");
        const result = await this.listUsersUseCase.execute(toUserQueryOptions(query));
        paginated(res, mapPaginated(result, toUserResponse));
    };

    getById = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        ok(res, toUserResponse(await this.getUserUseCase.execute(principal, id)));
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        const body = getValidated<UpdateUserDto>(res, "body");
        const user = await this.updateUserUseCase.execute(principal, id, body);
        ok(res, toUserResponse(user), "User updated");
    };

    updateMe = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const body = getValidated<UpdateMeDto>(res, "body");
        const user = await this.updateUserUseCase.execute(principal, principal.userId, body);
        ok(res, toUserResponse(user), "Profile updated");
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        const principal = requirePrincipal(req);
        const { id } = getValidated<UuidParam>(res, "params");
        await this.deleteUserUseCase.execute(principal, id);
        noContent(res);
    };
}
