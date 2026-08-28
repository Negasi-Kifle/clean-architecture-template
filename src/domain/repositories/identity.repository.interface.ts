import type { UserEntity } from "../entities";

/**
 * The narrow set of lookups that MUST cross tenant boundaries.
 *
 * Login resolves a user from an email before any tenant is known, so it cannot
 * be tenant-scoped by definition — the tenant is an *output* of the lookup,
 * not an input. Isolating those queries here means the audit question
 * "what in this codebase can read across tenants?" has a one-file answer.
 *
 * Implementations must run inside `runCrossTenant()`.
 */
export interface IIdentityRepository {
    /** Resolves a login identifier to a user in any tenant. */
    findByEmailOrPhone(identifier: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    findById(id: string): Promise<UserEntity | null>;
}
