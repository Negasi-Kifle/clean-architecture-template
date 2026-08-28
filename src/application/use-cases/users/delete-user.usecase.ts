import {
    BusinessRuleError,
    NotFoundError,
    SessionRevocationReason,
    UserRole,
    type AuthenticatedPrincipal,
    type IUnitOfWork,
} from "../../../domain";
import { assertTenantAdmin } from "../../authorization";

/**
 * Soft-deletes a user and everything that depends on their identity.
 *
 * Soft rather than hard on purpose: a hard delete breaks every historical
 * record that references the user (who approved this, who created that) and
 * cannot be undone after a mistaken click.
 */
export class DeleteUserUseCase {
    constructor(private readonly unitOfWork: IUnitOfWork) {}

    async execute(principal: AuthenticatedPrincipal, userId: string): Promise<void> {
        assertTenantAdmin(principal);

        if (principal.userId === userId) {
            throw new BusinessRuleError("You cannot delete your own account");
        }

        await this.unitOfWork.run(async (repositories) => {
            const user = await repositories.users.findById(userId);
            if (!user) throw new NotFoundError("User", userId);

            if (user.hasRole(UserRole.TenantAdmin)) {
                const admins = await repositories.users.countByRole(UserRole.TenantAdmin);
                if (admins <= 1) {
                    throw new BusinessRuleError(
                        "This is the last administrator for this workspace and cannot be deleted",
                    );
                }
            }

            const employee = await repositories.employees.findByUserId(userId);
            if (employee) {
                employee.softDelete();
                await repositories.employees.update(employee);
            }

            user.softDelete();
            await repositories.users.update(user);

            await repositories.sessions.revokeAllForUser(
                userId,
                SessionRevocationReason.CREDENTIALS_CHANGED,
            );
        });
    }
}
