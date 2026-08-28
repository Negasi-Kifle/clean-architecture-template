/**
 * Resolved pagination window.
 *
 * `page` and `limit` are carried alongside `skip` and `take` rather than being
 * re-derived downstream. The reference implementation this template replaces
 * recomputed `page` as `Math.floor(skip / take) + 1`, which is lossy and
 * breaks the moment a caller supplies a skip that is not a multiple of take.
 */
export interface Pagination {
    readonly skip: number;
    readonly take: number;
    readonly page: number;
    readonly limit: number;
}

/** The envelope every list use case returns. */
export interface Paginated<T> {
    readonly items: T[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
    readonly hasNext: boolean;
    readonly hasPrev: boolean;
}
