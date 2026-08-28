import type { Pagination } from "../../domain/interfaces";
import type { PaginationQuery } from "../DTOs/request/common.dto";

/**
 * The one place `(page - 1) * limit` is written.
 *
 * Every list mapper delegates here, so an off-by-one is a single-file fix
 * rather than a hunt through one mapper per domain.
 */
export function toPagination(query: PaginationQuery): Pagination {
    return {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        page: query.page,
        limit: query.limit,
    };
}
