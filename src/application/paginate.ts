import type { Paginated, QueryOptions } from "../domain/interfaces";
import type { ReadRepository } from "../domain/repositories";

/**
 * Run the list query and the count against identical filters and assemble the
 * response envelope.
 *
 * `page` and `limit` are taken from the resolved pagination window rather than
 * re-derived from `skip`/`take`. Re-deriving (`Math.floor(skip / take) + 1`) is
 * wrong for any skip that is not a multiple of take, and is one of those bugs
 * that only shows up once a client starts using cursor-ish offsets.
 */
export async function paginate<TEntity, TFilters, TSortField extends string>(
    repository: ReadRepository<TEntity, TFilters, TSortField>,
    options: QueryOptions<TFilters, TSortField>,
): Promise<Paginated<TEntity>> {
    const [items, total] = await Promise.all([
        repository.findMany(options),
        repository.count(options.filters),
    ]);

    const { page, limit } = options.pagination;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1 && total > 0,
    };
}

/** Map the items of an already-assembled envelope without recomputing the metadata. */
export function mapPaginated<TIn, TOut>(
    source: Paginated<TIn>,
    map: (item: TIn) => TOut,
): Paginated<TOut> {
    return { ...source, items: source.items.map(map) };
}
