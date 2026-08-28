import { z } from "zod";
import { SortDirection } from "../../../domain/enums";
import type { SortClause } from "../../../domain/interfaces";
import { config } from "../../../config";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Shared query fragments.
 *
 * `limit` is capped. An uncapped limit is a denial-of-service primitive: one
 * request for `?limit=1000000` can pull an entire table into memory and hold a
 * connection open while it serialises.
 */
export const paginationSchema = z.object({
    page: z.coerce.number().int().positive().default(DEFAULT_PAGE),
    limit: z.coerce.number().int().positive().max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/** Query strings are always strings; `?isActive=false` must not be truthy. */
export const booleanQuery = z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional();

export const dateQuery = z.coerce.date().optional();

export const uuidParam = z.object({ id: z.uuid("id must be a valid UUID") }).strict();
export type UuidParam = z.infer<typeof uuidParam>;

/**
 * `?sort=-createdAt,lastName` → [createdAt desc, lastName asc].
 *
 * `allowed` is a closed list per endpoint, so a client cannot order by a
 * column that is not indexed (a cheap way to make the database do a full sort
 * on every request) or probe for the existence of one that is not exposed.
 */
export function sortQuery<const TFields extends readonly string[]>(allowed: TFields) {
    const allowedSet = new Set<string>(allowed);

    return z
        .string()
        .optional()
        .transform((raw, ctx): SortClause<TFields[number]>[] => {
            if (!raw?.trim()) return [];

            const clauses: SortClause<TFields[number]>[] = [];
            for (const token of raw.split(",")) {
                const trimmed = token.trim();
                if (!trimmed) continue;

                const descending = trimmed.startsWith("-");
                const field = descending ? trimmed.slice(1) : trimmed;

                if (!allowedSet.has(field)) {
                    ctx.addIssue({
                        code: "custom",
                        message: `Cannot sort by "${field}". Allowed: ${allowed.join(", ")}`,
                    });
                    continue;
                }

                clauses.push({
                    field: field as TFields[number],
                    direction: descending ? SortDirection.Desc : SortDirection.Asc,
                });
            }
            return clauses;
        });
}

/**
 * Password rules, defined once.
 *
 * The reference this template replaces carried three different minimums in
 * three files (1 on create, 6 on change, 8 on reset), which means the weakest
 * one is the real policy.
 */
export const passwordSchema = z
    .string()
    .min(
        config.auth.passwordMinLength,
        `Password must be at least ${config.auth.passwordMinLength} characters`,
    )
    .max(128, "Password must be at most 128 characters")
    .refine((value) => /[a-z]/.test(value), "Password must contain a lowercase letter")
    .refine((value) => /[A-Z]/.test(value), "Password must contain an uppercase letter")
    .refine((value) => /\d/.test(value), "Password must contain a digit");

export const emailSchema = z
    .email("Must be a valid email address")
    .max(254)
    .transform((value) => value.trim().toLowerCase());

/**
 * Deliberately permissive and country-agnostic: 7-20 characters of digits with
 * optional separators. Tighten it here — in the DTO, per project — rather than
 * in the domain, so that a template clone for another country is a one-line
 * change instead of an edit to the entity.
 */
export const phoneSchema = z
    .string()
    .trim()
    .regex(/^\+?[\d\s\-().]{7,20}$/, "Must be a valid phone number");

export const nameSchema = z.string().trim().min(2).max(100);
