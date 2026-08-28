import {
    ConflictError,
    NotFoundError,
    ValidationError,
    type AuthenticatedPrincipal,
    type EmployeeEntity,
    type IUnitOfWork,
} from "../../../domain";
import { assertTenantAdmin } from "../../authorization";

export interface UpdateEmployeeInputDto {
    branchId?: string | null;
    employeeNumber?: string | null;
    jobTitle?: string | null;
    hireDate?: Date | null;
}

export class UpdateEmployeeUseCase {
    constructor(
        private readonly unitOfWork: IUnitOfWork,
        private readonly branchesEnabled: boolean,
    ) {}

    async execute(
        principal: AuthenticatedPrincipal,
        employeeId: string,
        input: UpdateEmployeeInputDto,
    ): Promise<EmployeeEntity> {
        assertTenantAdmin(principal);

        if (input.branchId && !this.branchesEnabled) {
            throw ValidationError.forField(
                "branchId",
                "Branches are disabled for this deployment (BRANCHES_ENABLED=false)",
            );
        }

        return this.unitOfWork.run(async (repositories) => {
            const employee = await repositories.employees.findById(employeeId);
            if (!employee) throw new NotFoundError("Employee", employeeId);

            if (input.branchId) {
                const branch = await repositories.branches.findById(input.branchId);
                if (!branch) throw new NotFoundError("Branch", input.branchId);
            }

            if (input.employeeNumber && input.employeeNumber !== employee.employeeNumber) {
                const existing = await repositories.employees.findByEmployeeNumber(
                    input.employeeNumber,
                );
                if (existing && existing.id !== employeeId) {
                    throw new ConflictError("Employee number is already in use", "employeeNumber");
                }
            }

            employee.update(input);
            const updated = await repositories.employees.update(employee);

            // Same reason as create: keep the response shape identical to a GET.
            return (await repositories.employees.findDetailById(updated.id)) ?? updated;
        });
    }
}
