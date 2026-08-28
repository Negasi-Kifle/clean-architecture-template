import {
    BusinessRuleError,
    ConflictError,
    NotFoundError,
    TenantEntity,
    UserEntity,
    UserRole,
    type AuthenticatedPrincipal,
    type IPasswordHasher,
    type ITenantRepository,
    type IUnitOfWork,
    type Paginated,
    type QueryOptions,
    type TenantFilters,
    type TenantSortField,
} from "../../../domain";
import { assertPlatformAdmin } from "../../authorization";
import { paginate } from "../../paginate";
import { runCrossTenant, runWithTenant } from "../../../shared/request-context";

export interface CreateTenantInputDto {
    slug: string;
    name: string;
    /** Optional first administrator, created inside the same transaction. */
    admin?: {
        firstName: string;
        lastName: string;
        email: string;
        phoneNumber: string;
        password: string;
    };
}

export interface UpdateTenantInputDto {
    name?: string;
    isActive?: boolean;
}

export interface CreateTenantResult {
    tenant: TenantEntity;
    admin?: UserEntity;
}

/**
 * Tenant administration is platform-admin only, and every method runs
 * cross-tenant by necessity — the tenant registry is the thing tenants are
 * scoped to, so it cannot itself be scoped.
 *
 * In single-tenant mode these routes are not mounted at all.
 */
export class CreateTenantUseCase {
    constructor(
        private readonly tenantRepository: ITenantRepository,
        private readonly unitOfWork: IUnitOfWork,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(
        principal: AuthenticatedPrincipal,
        input: CreateTenantInputDto,
    ): Promise<CreateTenantResult> {
        assertPlatformAdmin(principal);

        const slug = input.slug.trim().toLowerCase();
        const existing = await runCrossTenant(() => this.tenantRepository.findBySlug(slug));
        if (existing) throw new ConflictError("A workspace with this slug already exists", "slug");

        const tenant = await runCrossTenant(() =>
            this.tenantRepository.create(TenantEntity.create({ slug, name: input.name })),
        );

        if (!input.admin) return { tenant };

        // The first admin is created inside the NEW tenant's scope, so the
        // same tenant-scoping rules apply as for any other write.
        const admin = await runWithTenant(tenant.id, () =>
            this.unitOfWork.run(async (repositories) =>
                repositories.users.create(
                    UserEntity.create({
                        tenantId: tenant.id,
                        firstName: input.admin!.firstName,
                        lastName: input.admin!.lastName,
                        email: input.admin!.email,
                        phoneNumber: input.admin!.phoneNumber,
                        passwordHash: await this.passwordHasher.hash(input.admin!.password),
                        roles: [UserRole.TenantAdmin],
                        mustChangePassword: true,
                    }),
                ),
            ),
        );

        return { tenant, admin };
    }
}

export class ListTenantsUseCase {
    constructor(private readonly tenantRepository: ITenantRepository) {}

    async execute(
        principal: AuthenticatedPrincipal,
        options: QueryOptions<TenantFilters, TenantSortField>,
    ): Promise<Paginated<TenantEntity>> {
        assertPlatformAdmin(principal);
        return runCrossTenant(() => paginate(this.tenantRepository, options));
    }
}

export class GetTenantUseCase {
    constructor(private readonly tenantRepository: ITenantRepository) {}

    async execute(principal: AuthenticatedPrincipal, tenantId: string): Promise<TenantEntity> {
        assertPlatformAdmin(principal);
        const tenant = await runCrossTenant(() => this.tenantRepository.findById(tenantId));
        if (!tenant || tenant.isSystem) throw new NotFoundError("Tenant", tenantId);
        return tenant;
    }
}

export class UpdateTenantUseCase {
    constructor(private readonly tenantRepository: ITenantRepository) {}

    async execute(
        principal: AuthenticatedPrincipal,
        tenantId: string,
        input: UpdateTenantInputDto,
    ): Promise<TenantEntity> {
        assertPlatformAdmin(principal);

        return runCrossTenant(async () => {
            const tenant = await this.tenantRepository.findById(tenantId);
            if (!tenant || tenant.isSystem) throw new NotFoundError("Tenant", tenantId);

            tenant.update(input);
            return this.tenantRepository.update(tenant);
        });
    }
}

export class DeleteTenantUseCase {
    constructor(private readonly tenantRepository: ITenantRepository) {}

    async execute(principal: AuthenticatedPrincipal, tenantId: string): Promise<void> {
        assertPlatformAdmin(principal);

        if (principal.tenantId === tenantId) {
            throw new BusinessRuleError("You cannot delete the workspace you are signed in to");
        }

        await runCrossTenant(async () => {
            const tenant = await this.tenantRepository.findById(tenantId);
            if (!tenant || tenant.isSystem) throw new NotFoundError("Tenant", tenantId);

            // Soft delete only. Cascading a hard delete across every table a
            // tenant owns is irreversible and, at any real data volume, a
            // long-running lock on production.
            tenant.softDelete();
            await this.tenantRepository.update(tenant);
        });
    }
}
