import {
    CreateUserUseCase,
    DeleteUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UpdateUserUseCase,
} from "../application/use-cases/users";
import { UserController } from "../presentation/controllers";
import { UserRepository } from "../infrastructure/prisma/repositories";
import { prisma } from "../infrastructure/prisma/prisma.client";
import type { SharedInfra } from "./shared-infra";

export interface UserModule {
    controller: UserController;
}

export function buildUserModule(infra: SharedInfra): UserModule {
    const userRepository = new UserRepository(prisma);

    return {
        controller: new UserController(
            new CreateUserUseCase(userRepository, infra.passwordHasher),
            new ListUsersUseCase(userRepository),
            new GetUserUseCase(userRepository),
            new UpdateUserUseCase(infra.unitOfWork),
            new DeleteUserUseCase(infra.unitOfWork),
        ),
    };
}
