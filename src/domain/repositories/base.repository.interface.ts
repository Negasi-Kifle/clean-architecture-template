import type { QueryOptions } from "../interfaces";

/**
 * Generic repository contracts.
 *
 * Three deliberate departures from the shape this template replaces:
 *
 * 1. `update` takes a full entity, not `Partial<T>`. Declaring `Partial<T>` on
 *    the interface while every implementation accepts `T` compiles only
 *    because TypeScript method parameters are bivariant — it is an unsound
 *    contract that hides real type errors.
 *
 * 2. Filters and sort fields are explicit type parameters. `Partial<Entity>`
 *    cannot express `search`, `createdFrom` or `includeDeleted`, and it lets
 *    `?sort=passwordHash` type-check.
 *
 * 3. `softDelete` and `hardDelete` are separate operations. Which one a use
 *    case wants is a business decision, not something to leave to a repository.
 */

export interface ReadRepository<TEntity, TFilters, TSortField extends string> {
    findById(id: string): Promise<TEntity | null>;
    findMany(options: QueryOptions<TFilters, TSortField>): Promise<TEntity[]>;
    count(filters: TFilters): Promise<number>;
    exists(filters: TFilters): Promise<boolean>;
}

export interface WriteRepository<TEntity> {
    create(entity: TEntity): Promise<TEntity>;
    update(entity: TEntity): Promise<TEntity>;
    /** Sets `deletedAt`. The row stays for audit and referential integrity. */
    softDelete(id: string): Promise<void>;
    /** Removes the row. Use only where retention rules require it. */
    hardDelete(id: string): Promise<void>;
}

export interface CrudRepository<TEntity, TFilters, TSortField extends string>
    extends ReadRepository<TEntity, TFilters, TSortField>, WriteRepository<TEntity> {}
