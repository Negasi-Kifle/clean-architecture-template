import { mapPaginated, paginate } from "./paginate";
import type { QueryOptions } from "../domain/interfaces";
import type { ReadRepository } from "../domain/repositories";

type Filters = { search?: string };
type SortField = "createdAt";

function repositoryReturning(
    items: string[],
    total: number,
): ReadRepository<string, Filters, SortField> {
    return {
        findMany: jest.fn().mockResolvedValue(items),
        count: jest.fn().mockResolvedValue(total),
        findById: jest.fn(),
        exists: jest.fn(),
    };
}

function options(page: number, limit: number): QueryOptions<Filters, SortField> {
    return {
        filters: {},
        sort: [],
        pagination: { skip: (page - 1) * limit, take: limit, page, limit },
    };
}

describe("paginate", () => {
    it("computes the envelope from the requested page, not from skip/take", async () => {
        const result = await paginate(repositoryReturning(["a", "b"], 25), options(2, 10));

        expect(result).toMatchObject({
            page: 2,
            limit: 10,
            total: 25,
            totalPages: 3,
            hasNext: true,
            hasPrev: true,
        });
    });

    it("reports no pages and no navigation for an empty result", async () => {
        const result = await paginate(repositoryReturning([], 0), options(1, 10));

        expect(result).toMatchObject({ total: 0, totalPages: 0, hasNext: false, hasPrev: false });
    });

    it("has no next page on the last page", async () => {
        const result = await paginate(repositoryReturning(["y"], 21), options(3, 10));
        expect(result.hasNext).toBe(false);
    });

    /**
     * Deriving `page` as floor(skip/take)+1 — as the implementation this
     * template replaces did — reports page 1 here instead of page 2.
     */
    it("reports the true page even when skip is not a multiple of take", async () => {
        const result = await paginate(repositoryReturning(["a"], 100), {
            filters: {},
            sort: [],
            pagination: { skip: 5, take: 10, page: 2, limit: 10 },
        });

        expect(result.page).toBe(2);
    });

    it("runs the list and the count against the same filters", async () => {
        const repository = repositoryReturning(["a"], 1);
        const query = { ...options(1, 10), filters: { search: "ada" } };

        await paginate(repository, query);

        expect(repository.findMany).toHaveBeenCalledWith(query);
        expect(repository.count).toHaveBeenCalledWith({ search: "ada" });
    });
});

describe("mapPaginated", () => {
    it("maps items and leaves the metadata untouched", async () => {
        const source = await paginate(repositoryReturning(["a", "b"], 2), options(1, 10));

        const mapped = mapPaginated(source, (value) => value.toUpperCase());

        expect(mapped.items).toEqual(["A", "B"]);
        expect(mapped.total).toBe(2);
    });
});
