import type { IUnitOfWork, TransactionalRepositories } from "../../domain/repositories";
import { prisma, type PrismaTx } from "./prisma.client";
import { mapPrismaErrors } from "./exceptions";
import {
    BranchRepository,
    EmployeeRepository,
    PasswordResetTokenRepository,
    SessionRepository,
    TenantRepository,
    UserRepository,
} from "./repositories";

/** Repositories bound to one transaction client. */
export function buildRepositories(db: PrismaTx): TransactionalRepositories {
    return {
        tenants: new TenantRepository(db),
        branches: new BranchRepository(db),
        users: new UserRepository(db),
        employees: new EmployeeRepository(db),
        sessions: new SessionRepository(db),
        passwordResetTokens: new PasswordResetTokenRepository(db),
    };
}

export interface UnitOfWorkOptions {
    /** Statement timeout for the whole transaction. Default 10s. */
    timeoutMs?: number;
    /** How long to wait for a connection from the pool. Default 5s. */
    maxWaitMs?: number;
}

/**
 * Prisma-backed unit of work.
 *
 * The tenant scope is ambient (AsyncLocalStorage), and `$transaction`'s
 * callback runs in the same async context, so every query inside the
 * transaction is scoped exactly as it would be outside — no extra plumbing,
 * and no way to accidentally run half a transaction unscoped.
 *
 * Explicit timeouts matter: Prisma's default interactive-transaction timeout
 * is 5 seconds, and a transaction that quietly exceeds it aborts mid-way with
 * an error most people misread as a connection problem.
 */
export class PrismaUnitOfWork implements IUnitOfWork {
    constructor(private readonly options: UnitOfWorkOptions = {}) {}

    async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
        return mapPrismaErrors(() =>
            prisma.$transaction((tx) => work(buildRepositories(tx as PrismaTx)), {
                timeout: this.options.timeoutMs ?? 10_000,
                maxWait: this.options.maxWaitMs ?? 5_000,
            }),
        );
    }
}
