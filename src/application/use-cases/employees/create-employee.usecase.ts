import {
    ConflictError,
    EmployeeEntity,
    NotFoundError,
    UserEntity,
    UserRole,
    UserType,
    ValidationError,
    normalizeEmail,
    normalizePhone,
    type AuthenticatedPrincipal,
    type EmployeeWithUser,
    type IPasswordHasher,
    type ISecureRandom,
    type IUnitOfWork,
} from "../../../domain";
import { assertCanAssignRoles, assertTenantAdmin } from "../../authorization";

export interface CreateEmployeeInputDto {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    roles: UserRole[];
    /** Omit to have one generated and returned once. */
    password?: string;
    branchId?: string | null;
    employeeNumber?: string | null;
    jobTitle?: string | null;
    hireDate?: Date | null;
    isActive?: boolean;
}

export interface CreateEmployeeResult extends EmployeeWithUser {
    /**
     * Present ONLY when the password was generated here. Returned exactly once,
     * never stored in plaintext, never logged.
     */
    generatedPassword?: string;
}

export interface CreateEmployeeDependencies {
    unitOfWork: IUnitOfWork;
    passwordHasher: IPasswordHasher;
    secureRandom: ISecureRandom;
    branchesEnabled: boolean;
    /** From config. When unset a random password is generated per employee. */
    defaultPassword?: string;
}

/**
 * Creates the User and the Employee together, atomically.
 *
 * The transaction lives here, in the application layer, expressed through the
 * unit of work — not as a bespoke `createEmployeeAndUser` method on a
 * repository. Repository-level transactions work for the first multi-aggregate
 * operation and stop composing at the second: the method has to live on one of
 * the two repositories, and the choice is arbitrary.
 */
export class CreateEmployeeUseCase {
    constructor(private readonly deps: CreateEmployeeDependencies) {}

    async execute(
        principal: AuthenticatedPrincipal,
        input: CreateEmployeeInputDto,
    ): Promise<CreateEmployeeResult> {
        assertTenantAdmin(principal);
        assertCanAssignRoles(principal, input.roles);

        if (input.branchId && !this.deps.branchesEnabled) {
            throw ValidationError.forField(
                "branchId",
                "Branches are disabled for this deployment (BRANCHES_ENABLED=false)",
            );
        }

        const email = normalizeEmail(input.email);
        const phoneNumber = normalizePhone(input.phoneNumber);

        // A generated password is returned once and never persisted in the
        // clear. Falling back to a hardcoded literal — as the reference
        // implementation did with '123456' — gives every account in the system
        // the same known password.
        const generated = input.password ?? this.deps.defaultPassword ?? this.generatePassword();
        const isGenerated = !input.password;

        const result = await this.deps.unitOfWork.run(async (repositories) => {
            const taken = await repositories.users.existsByEmailOrPhone(email, phoneNumber);
            if (taken.emailTaken) throw new ConflictError("Email is already registered", "email");
            if (taken.phoneTaken) {
                throw new ConflictError("Phone number is already registered", "phoneNumber");
            }

            if (input.branchId) {
                const branch = await repositories.branches.findById(input.branchId);
                if (!branch) throw new NotFoundError("Branch", input.branchId);
            }

            if (input.employeeNumber) {
                const existing = await repositories.employees.findByEmployeeNumber(
                    input.employeeNumber,
                );
                if (existing) {
                    throw new ConflictError("Employee number is already in use", "employeeNumber");
                }
            }

            const user = await repositories.users.create(
                UserEntity.create({
                    tenantId: principal.tenantId,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    email,
                    phoneNumber,
                    passwordHash: await this.deps.passwordHasher.hash(generated),
                    roles: input.roles,
                    userType: UserType.Employee,
                    isActive: input.isActive,
                    // Anyone whose password was chosen for them must replace it.
                    mustChangePassword: true,
                }),
            );

            const created = await repositories.employees.create(
                EmployeeEntity.create({
                    tenantId: principal.tenantId,
                    userId: user.id,
                    branchId: input.branchId ?? null,
                    employeeNumber: input.employeeNumber ?? null,
                    jobTitle: input.jobTitle ?? null,
                    hireDate: input.hireDate ?? null,
                }),
            );

            // Re-read with the relations attached so the create response has
            // the same shape as a GET. Returning a bare row here forces every
            // client to follow the create with a fetch just to render it.
            const employee = (await repositories.employees.findDetailById(created.id)) ?? created;

            return { employee, user };
        });

        return isGenerated ? { ...result, generatedPassword: generated } : result;
    }

    /** 16 URL-safe characters of CSPRNG output, shown to the admin exactly once. */
    private generatePassword(): string {
        return `${this.deps.secureRandom.opaqueToken(12).slice(0, 14)}Aa1`;
    }
}
