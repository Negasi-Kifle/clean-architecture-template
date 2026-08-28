import type { SortClause } from "../../../domain/interfaces";
import { SortDirection } from "../../../domain/enums";

/**
 * Turn the domain's sort clauses into a Prisma `orderBy` array.
 *
 * Repositories in the codebase this template replaces accepted a `sort` option
 * and silently dropped it — the interface promised ordering that no
 * implementation delivered. Every list method here routes through this helper,
 * and `fallback` guarantees a deterministic order so that paging never
 * duplicates or skips a row when the sort key ties.
 */
export function buildOrderBy<TField extends string>(
    sort: readonly SortClause<TField>[],
    fallback: { [key: string]: "asc" | "desc" } = { createdAt: "desc" },
): Array<Record<string, "asc" | "desc">> {
    const clauses = sort.map((clause) => ({
        [clause.field]:
            clause.direction === SortDirection.Asc ? ("asc" as const) : ("desc" as const),
    }));

    // `id` last as a tiebreaker: without it, two rows sharing a createdAt can
    // swap places between page 1 and page 2.
    return [...clauses, ...(clauses.length === 0 ? [fallback] : []), { id: "asc" as const }];
}

/** Soft-delete predicate. Applied explicitly by every read path. */
export function softDeleteWhere(includeDeleted: boolean | undefined) {
    return includeDeleted ? {} : { deletedAt: null };
}

/** Case-insensitive "contains" across several columns. */
export function searchAcross(
    search: string | undefined,
    fields: readonly string[],
): Array<Record<string, { contains: string; mode: "insensitive" }>> | undefined {
    const term = search?.trim();
    if (!term) return undefined;
    return fields.map((field) => ({ [field]: { contains: term, mode: "insensitive" as const } }));
}
