import type {
    IBranchRepository,
    IEmployeeRepository,
    IPasswordResetTokenRepository,
    ISessionRepository,
    ITenantRepository,
    IUserRepository,
} from "./index";

/** Repositories bound to one open transaction. */
export interface TransactionalRepositories {
    readonly tenants: ITenantRepository;
    readonly branches: IBranchRepository;
    readonly users: IUserRepository;
    readonly employees: IEmployeeRepository;
    readonly sessions: ISessionRepository;
    readonly passwordResetTokens: IPasswordResetTokenRepository;
}

/**
 * Runs a unit of work across several aggregates atomically.
 *
 * This exists so that "create a user and an employee together" is expressed in
 * the APPLICATION layer, where the business rule lives, instead of becoming a
 * bespoke `createEmployeeAndUser` method bolted onto a repository. The
 * repository-method approach works for the first such case and collapses by
 * the fourth, because every new combination needs another method on another
 * repository, and none of them compose.
 *
 * Everything inside `work` shares one transaction and one tenant scope; if the
 * callback throws, nothing is committed.
 */
export interface IUnitOfWork {
    run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T>;
}
