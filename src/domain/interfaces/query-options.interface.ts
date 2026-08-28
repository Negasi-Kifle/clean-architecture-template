import type { SortDirection } from "../enums";
import type { Pagination } from "./pagination.interface";

/** One ordering clause. Repositories apply these in array order. */
export interface SortClause<TField extends string> {
    readonly field: TField;
    readonly direction: SortDirection;
}

/**
 * What a list repository method receives.
 *
 * `TFilters` is a first-class type parameter rather than `Partial<TEntity>`.
 * That matters: real filters are not a subset of entity fields. `search`,
 * `createdFrom`, `includeDeleted` and `branchIds` have no counterpart on the
 * entity, and forcing them through `Partial<Entity>` either loses type safety
 * or quietly gets dropped.
 *
 * `TSortField` is a closed union per repository, so `?sort=passwordHash` is a
 * compile error rather than a data leak.
 */
export interface QueryOptions<TFilters, TSortField extends string> {
    readonly filters: TFilters;
    readonly sort: readonly SortClause<TSortField>[];
    readonly pagination: Pagination;
}

/** Filters every soft-deletable repository understands. */
export interface SoftDeleteFilter {
    /** Defaults to false everywhere. Only admin/audit paths should set it. */
    readonly includeDeleted?: boolean;
}
