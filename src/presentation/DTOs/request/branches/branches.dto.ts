import { z } from "zod";
import { booleanQuery, emailSchema, paginationSchema, phoneSchema, sortQuery } from "../common.dto";

export const BRANCH_SORT_FIELDS = ["createdAt", "updatedAt", "name", "code", "city"] as const;

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const createBranchSchema = z
    .object({
        name: z.string().trim().min(1, "Branch name is required").max(200),
        code: z.string().trim().min(1).max(50).nullable().optional(),
        description: optionalText(1000),
        street: optionalText(200),
        city: optionalText(120),
        state: optionalText(120),
        zipCode: optionalText(20),
        country: optionalText(120),
        phoneNumber: phoneSchema.nullable().optional(),
        email: emailSchema.nullable().optional(),
        mapsUrl: z.url("mapsUrl must be a valid URL").max(2048).nullable().optional(),
        isActive: z.boolean().default(true),
    })
    .strict();
export type CreateBranchDto = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = createBranchSchema
    .partial()
    .strict()
    .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;

export const listBranchesSchema = paginationSchema
    .extend({
        search: z.string().trim().min(1).max(100).optional(),
        code: z.string().trim().optional(),
        city: z.string().trim().optional(),
        country: z.string().trim().optional(),
        isActive: booleanQuery,
        includeDeleted: booleanQuery,
        sort: sortQuery(BRANCH_SORT_FIELDS),
    })
    .strict();
export type ListBranchesDto = z.infer<typeof listBranchesSchema>;
