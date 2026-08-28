import {
    CreateTenantUseCase,
    DeleteTenantUseCase,
    GetTenantUseCase,
    ListTenantsUseCase,
    UpdateTenantUseCase,
} from "../application/use-cases/tenants";
import { TenantController } from "../presentation/controllers";
import { TenantRepository } from "../infrastructure/prisma/repositories";
import { prisma } from "../infrastructure/prisma/prisma.client";
import type { SharedInfra } from "./shared-infra";

export interface TenantModule {
    controller: TenantController;
}

export function buildTenantModule(infra: SharedInfra): TenantModule {
    const tenantRepository = new TenantRepository(prisma);

    return {
        controller: new TenantController(
            new CreateTenantUseCase(tenantRepository, infra.unitOfWork, infra.passwordHasher),
            new ListTenantsUseCase(tenantRepository),
            new GetTenantUseCase(tenantRepository),
            new UpdateTenantUseCase(tenantRepository),
            new DeleteTenantUseCase(tenantRepository),
        ),
    };
}
