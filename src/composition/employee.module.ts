import { config } from "../config";
import {
    CreateEmployeeUseCase,
    DeleteEmployeeUseCase,
    GetEmployeeUseCase,
    ListEmployeesUseCase,
    UpdateEmployeeUseCase,
} from "../application/use-cases/employees";
import { EmployeeController } from "../presentation/controllers";
import { EmployeeRepository } from "../infrastructure/prisma/repositories";
import { prisma } from "../infrastructure/prisma/prisma.client";
import type { SharedInfra } from "./shared-infra";

export interface EmployeeModule {
    controller: EmployeeController;
}

export function buildEmployeeModule(infra: SharedInfra): EmployeeModule {
    const employeeRepository = new EmployeeRepository(prisma);

    return {
        controller: new EmployeeController(
            new CreateEmployeeUseCase({
                unitOfWork: infra.unitOfWork,
                passwordHasher: infra.passwordHasher,
                secureRandom: infra.secureRandom,
                branchesEnabled: config.features.branchesEnabled,
                defaultPassword: config.auth.defaultEmployeePassword,
            }),
            new ListEmployeesUseCase(employeeRepository),
            new GetEmployeeUseCase(employeeRepository),
            new UpdateEmployeeUseCase(infra.unitOfWork, config.features.branchesEnabled),
            new DeleteEmployeeUseCase(infra.unitOfWork),
        ),
    };
}
