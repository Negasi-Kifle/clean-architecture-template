import {
    BranchEntity,
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    type AuthenticatedPrincipal,
    type BranchFilters,
    type BranchSortField,
    type IBranchRepository,
    type Paginated,
    type QueryOptions,
} from "../../../domain";
import { assertTenantAdmin } from "../../authorization";
import { paginate } from "../../paginate";

export interface CreateBranchInputDto {
    name: string;
    code?: string | null;
    description?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    mapsUrl?: string | null;
    isActive?: boolean;
}

export type UpdateBranchInputDto = Partial<CreateBranchInputDto>;

export class CreateBranchUseCase {
    constructor(private readonly branchRepository: IBranchRepository) {}

    async execute(
        principal: AuthenticatedPrincipal,
        input: CreateBranchInputDto,
    ): Promise<BranchEntity> {
        assertTenantAdmin(principal);

        if (input.code) {
            const existing = await this.branchRepository.findByCode(input.code);
            if (existing) throw new ConflictError("Branch code is already in use", "code");
        }

        return this.branchRepository.create(
            BranchEntity.create({ ...input, tenantId: principal.tenantId }),
        );
    }
}

export class ListBranchesUseCase {
    constructor(private readonly branchRepository: IBranchRepository) {}

    async execute(
        options: QueryOptions<BranchFilters, BranchSortField>,
    ): Promise<Paginated<BranchEntity>> {
        return paginate(this.branchRepository, options);
    }
}

export class GetBranchUseCase {
    constructor(private readonly branchRepository: IBranchRepository) {}

    async execute(branchId: string): Promise<BranchEntity> {
        const branch = await this.branchRepository.findById(branchId);
        if (!branch) throw new NotFoundError("Branch", branchId);
        return branch;
    }
}

export class UpdateBranchUseCase {
    constructor(private readonly branchRepository: IBranchRepository) {}

    async execute(
        principal: AuthenticatedPrincipal,
        branchId: string,
        input: UpdateBranchInputDto,
    ): Promise<BranchEntity> {
        assertTenantAdmin(principal);

        const branch = await this.branchRepository.findById(branchId);
        if (!branch) throw new NotFoundError("Branch", branchId);

        if (input.code && input.code !== branch.code) {
            const existing = await this.branchRepository.findByCode(input.code);
            if (existing && existing.id !== branchId) {
                throw new ConflictError("Branch code is already in use", "code");
            }
        }

        branch.update(input);
        return this.branchRepository.update(branch);
    }
}

export class DeleteBranchUseCase {
    constructor(private readonly branchRepository: IBranchRepository) {}

    async execute(principal: AuthenticatedPrincipal, branchId: string): Promise<void> {
        assertTenantAdmin(principal);

        const branch = await this.branchRepository.findById(branchId);
        if (!branch) throw new NotFoundError("Branch", branchId);

        // Refuse rather than silently orphaning staff. The schema's ON DELETE
        // SET NULL would quietly unassign every employee here, which reads as
        // data loss to whoever clicked the button.
        const employees = await this.branchRepository.countEmployees(branchId);
        if (employees > 0) {
            throw new BusinessRuleError(
                `This branch still has ${employees} employee(s). Reassign them first.`,
            );
        }

        branch.softDelete();
        await this.branchRepository.update(branch);
    }
}
