import {
    NotFoundError,
    SessionRevocationReason,
    type AuthenticatedPrincipal,
    type IUnitOfWork,
} from "../../../domain";
import { assertTenantAdmin } from "../../authorization";

export interface DeleteEmployeeOptions {
    /**
     * Also deactivate the underlying user account. Defaults to true: an
     * offboarded employee who can still sign in is the whole problem.
     * Set false when the person keeps a non-staff account.
     */
    deactivateUser?: boolean;
}

/**
 * Soft-deletes the employee record.
 *
 * Note what this does NOT do: hard-delete the User row. The reference
 * implementation this replaces deleted the user inside the employee delete,
 * which destroyed the identity behind every historical reference and was
 * additionally redundant with the schema's ON DELETE CASCADE.
 */
export class DeleteEmployeeUseCase {
    constructor(private readonly unitOfWork: IUnitOfWork) {}

    async execute(
        principal: AuthenticatedPrincipal,
        employeeId: string,
        options: DeleteEmployeeOptions = {},
    ): Promise<void> {
        assertTenantAdmin(principal);
        const deactivateUser = options.deactivateUser ?? true;

        await this.unitOfWork.run(async (repositories) => {
            const employee = await repositories.employees.findById(employeeId);
            if (!employee) throw new NotFoundError("Employee", employeeId);

            employee.softDelete();
            await repositories.employees.update(employee);

            if (!deactivateUser) return;

            const user = await repositories.users.findById(employee.userId);
            if (!user) return;

            user.deactivate();
            await repositories.users.update(user);
            await repositories.sessions.revokeAllForUser(
                user.id,
                SessionRevocationReason.CREDENTIALS_CHANGED,
            );
        });
    }
}
