import { booleanQuery, paginationSchema, passwordSchema, sortQuery, uuidParam } from "./common.dto";
import { SortDirection } from "../../../domain/enums";

describe("paginationSchema", () => {
    it("applies defaults when nothing is supplied", () => {
        expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    });

    it("coerces the numeric strings a query string actually delivers", () => {
        expect(paginationSchema.parse({ page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 });
    });

    /** An uncapped limit is a denial-of-service primitive, not a convenience. */
    it("rejects a limit above the cap", () => {
        expect(paginationSchema.safeParse({ limit: "100000" }).success).toBe(false);
    });

    it("rejects page 0 and negative pages", () => {
        expect(paginationSchema.safeParse({ page: "0" }).success).toBe(false);
        expect(paginationSchema.safeParse({ page: "-1" }).success).toBe(false);
    });
});

describe("booleanQuery", () => {
    it('treats the string "false" as false', () => {
        expect(booleanQuery.parse("false")).toBe(false);
    });

    it('parses "true" as true', () => {
        expect(booleanQuery.parse("true")).toBe(true);
    });

    it("rejects anything else rather than guessing", () => {
        expect(booleanQuery.safeParse("yes").success).toBe(false);
        expect(booleanQuery.safeParse("1").success).toBe(false);
    });
});

describe("sortQuery", () => {
    const sort = sortQuery(["createdAt", "name"] as const);

    it("parses ascending and descending clauses in order", () => {
        expect(sort.parse("-createdAt,name")).toEqual([
            { field: "createdAt", direction: SortDirection.Desc },
            { field: "name", direction: SortDirection.Asc },
        ]);
    });

    it("returns no clauses when the parameter is absent", () => {
        expect(sort.parse(undefined)).toEqual([]);
    });

    /**
     * A closed allow-list stops a client ordering by an unindexed column — a
     * cheap way to make the database sort a whole table on every request — and
     * stops them probing for columns the API does not expose.
     */
    it("rejects a field that is not on the allow-list", () => {
        expect(sort.safeParse("passwordHash").success).toBe(false);
    });
});

describe("uuidParam", () => {
    it("rejects a non-UUID id before it reaches the database", () => {
        expect(uuidParam.safeParse({ id: "not-a-uuid" }).success).toBe(false);
    });

    it("accepts a valid UUID", () => {
        expect(uuidParam.safeParse({ id: "11111111-1111-4111-8111-111111111111" }).success).toBe(
            true,
        );
    });
});

describe("passwordSchema", () => {
    it("accepts a password meeting every rule", () => {
        expect(passwordSchema.safeParse("Str0ngEnough").success).toBe(true);
    });

    it.each([
        ["too short", "Ab1"],
        ["no digit", "NoDigitsHere"],
        ["no uppercase", "alllowercase1"],
        ["no lowercase", "ALLUPPERCASE1"],
    ])("rejects a password that is %s", (_label, value) => {
        expect(passwordSchema.safeParse(value).success).toBe(false);
    });
});
