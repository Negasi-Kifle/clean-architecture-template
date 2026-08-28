import {
    BusinessRuleError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    SessionRevocationReason,
    UserRole,
    UserType,
    normalizeEmail,
    normalizePhone,
    type AuthenticatedPrincipal,
    type IUnitOfWork,
    type UserEntity,
} from "../../../domain";
import { assertCanAssignRoles, assertSelfOrTenantAdmin, isTenantAdmin } from "../../authorization";

export interface UpdateUserInputDto {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    roles?: UserRole[];
    userType?: UserType;
    isActive?: boolean;
}

/** Fields a non-admin is allowed to change on their own record. */
const SELF_EDITABLE_FIELDS = ["firstName", "lastName", "phoneNumber", "email"] as const;

export class UpdateUserUseCase {
    constructor(private readonly unitOfWork: IUnitOfWork) {}

    async execute(
        principal: AuthenticatedPrincipal,
        userId: string,
        input: UpdateUserInputDto,
    ): Promise<UserEntity> {
        assertSelfOrTenantAdmin(principal, userId);

        if (!isTenantAdmin(principal)) {
            // A user editing themselves must not be able to grant themselves a
            // role or reactivate a disabled account.
            const attemptedPrivileged = Object.keys(input).filter(
                (key) =>
                    !SELF_EDITABLE_FIELDS.includes(key as (typeof SELF_EDITABLE_FIELDS)[number]),
            );
            if (attemptedPrivileged.length > 0) {
                throw new ForbiddenError(`You may not change: ${attemptedPrivileged.join(", ")}`);
            }
        }

        if (input.roles) assertCanAssignRoles(principal, input.roles);

        return this.unitOfWork.run(async (repositories) => {
            const user = await repositories.users.findById(userId);
            if (!user) throw new NotFoundError("User", userId);

            const email = input.email !== undefined ? normalizeEmail(input.email) : undefined;
            const phoneNumber =
                input.phoneNumber !== undefined ? normalizePhone(input.phoneNumber) : undefined;

            const emailChanging = email !== undefined && email !== user.email;
            const phoneChanging = phoneNumber !== undefined && phoneNumber !== user.phoneNumber;

            if (emailChanging || phoneChanging) {
                const taken = await repositories.users.existsByEmailOrPhone(
                    emailChanging ? email : undefined,
                    phoneChanging ? phoneNumber : undefined,
                    userId,
                );
                if (taken.emailTaken)
                    throw new ConflictError("Email is already registered", "email");
                if (taken.phoneTaken) {
                    throw new ConflictError("Phone number is already registered", "phoneNumber");
                }
            }

            // Removing the last tenant administrator locks everyone out of the
            // tenant with no way back in through the API.
            if (this.isDroppingLastAdmin(user, input)) {
                await this.assertNotLastTenantAdmin(repositories.users, user);
            }

            user.update({ ...input, email, phoneNumber });
            const updated = await repositories.users.update(user);

            // An email change or a deactivation invalidates outstanding tokens,
            // so the sessions holding them have to go too.
            if (emailChanging || input.isActive === false) {
                await repositories.sessions.revokeAllForUser(
                    userId,
                    SessionRevocationReason.CREDENTIALS_CHANGED,
                );
            }

            return updated;
        });
    }

    private isDroppingLastAdmin(user: UserEntity, input: UpdateUserInputDto): boolean {
        const losingAdminRole =
            input.roles !== undefined &&
            user.hasRole(UserRole.TenantAdmin) &&
            !input.roles.includes(UserRole.TenantAdmin);
        const beingDeactivated = input.isActive === false && user.hasRole(UserRole.TenantAdmin);
        return losingAdminRole || beingDeactivated;
    }

    private async assertNotLastTenantAdmin(
        users: { countByRole(role: UserRole): Promise<number> },
        user: UserEntity,
    ): Promise<void> {
        if (user.hasRole(UserRole.PlatformAdmin)) return;
        const admins = await users.countByRole(UserRole.TenantAdmin);
        if (admins <= 1) {
            throw new BusinessRuleError(
                "This is the last active administrator for this workspace. " +
                    "Promote another user first.",
            );
        }
    }
}
