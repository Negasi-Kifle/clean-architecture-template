import type { PrismaTx } from "../prisma.client";

/**
 * Common state for every Prisma repository.
 *
 * The client is injected rather than imported, which is what lets the same
 * repository class run against the root client or against a `$transaction`
 * client with no branching and no duplicate "…InTransaction" variants.
 */
export abstract class PrismaBaseRepository {
    constructor(protected readonly db: PrismaTx) {}
}
