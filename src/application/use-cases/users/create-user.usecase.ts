import {
    ConflictError,
    UserEntity,
    UserRole,
    UserType,
    normalizeEmail,
    normalizePhone,
    type AuthenticatedPrincipal,
    type IPasswordHasher,
    type IUserRepository,
} from "../../../domain";
import { assertCanAssignRoles, assertTenantAdmin } from "../../authorization";

export interface CreateUserInputDto {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    password: string;
    roles: UserRole[];
    userType?: UserType;
    isActive?: boolean;
    mustChangePassword?: boolean;
}

export class CreateUserUseCase {
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
    ) {}

    async execute(
        principal: AuthenticatedPrincipal,
        input: CreateUserInputDto,
    ): Promise<UserEntity> {
        assertTenantAdmin(principal);
        assertCanAssignRoles(principal, input.roles);

        const email = normalizeEmail(input.email);
        const phoneNumber = normalizePhone(input.phoneNumber);

        // Checked here for a clean, field-attributed 409. The database unique
        // index is still the authority — this check races, the index does not,
        // and the Prisma P2002 handler catches whatever slips through.
        const taken = await this.userRepository.existsByEmailOrPhone(email, phoneNumber);
        if (taken.emailTaken) throw new ConflictError("Email is already registered", "email");
        if (taken.phoneTaken) {
            throw new ConflictError("Phone number is already registered", "phoneNumber");
        }

        const user = UserEntity.create({
            tenantId: principal.tenantId,
            firstName: input.firstName,
            lastName: input.lastName,
            email,
            phoneNumber,
            passwordHash: await this.passwordHasher.hash(input.password),
            roles: input.roles,
            userType: input.userType,
            isActive: input.isActive,
            mustChangePassword: input.mustChangePassword,
        });

        return this.userRepository.create(user);
    }
}
