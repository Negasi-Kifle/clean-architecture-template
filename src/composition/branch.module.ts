import {
    CreateBranchUseCase,
    DeleteBranchUseCase,
    GetBranchUseCase,
    ListBranchesUseCase,
    UpdateBranchUseCase,
} from "../application/use-cases/branches";
import { BranchController } from "../presentation/controllers";
import { BranchRepository } from "../infrastructure/prisma/repositories";
import { prisma } from "../infrastructure/prisma/prisma.client";

export interface BranchModule {
    controller: BranchController;
}

export function buildBranchModule(): BranchModule {
    const branchRepository = new BranchRepository(prisma);

    return {
        controller: new BranchController(
            new CreateBranchUseCase(branchRepository),
            new ListBranchesUseCase(branchRepository),
            new GetBranchUseCase(branchRepository),
            new UpdateBranchUseCase(branchRepository),
            new DeleteBranchUseCase(branchRepository),
        ),
    };
}
