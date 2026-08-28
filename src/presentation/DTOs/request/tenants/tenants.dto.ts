import { z } from "zod";
import {
    booleanQuery,
    emailSchema,
    nameSchema,
    paginationSchema,
    passwordSchema,
    phoneSchema,
    sortQuery,
} from "../common.dto";

export const TENANT_SORT_FIELDS = ["createdAt", "updatedAt", "name", "slug"] as const;

export const createTenantSchema = z
    .object({
        slug: z
            .string()
            .trim()
            .toLowerCase()
            .min(2)
            .max(63)
            .regex(
                /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                "Slug must be lowercase alphanumeric words separated by hyphens",
            )
            // Reserved so a customer workspace can never collide with the
            // platform tenant or with routing prefixes.
            .refine(
                (value) => !["__platform__", "admin", "api", "www", "app"].includes(value),
                "This slug is reserved",
            ),
        name: z.string().trim().min(2).max(200),
        admin: z
            .object({
                firstName: nameSchema,
                lastName: nameSchema,
                email: emailSchema,
                phoneNumber: phoneSchema,
                password: passwordSchema,
            })
            .strict()
            .optional(),
    })
    .strict();
export type CreateTenantDto = z.infer<typeof createTenantSchema>;

export const updateTenantSchema = z
    .object({
        name: z.string().trim().min(2).max(200).optional(),
        isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export type UpdateTenantDto = z.infer<typeof updateTenantSchema>;

export const listTenantsSchema = paginationSchema
    .extend({
        search: z.string().trim().min(1).max(100).optional(),
        slug: z.string().trim().toLowerCase().optional(),
        isActive: booleanQuery,
        includeDeleted: booleanQuery,
        sort: sortQuery(TENANT_SORT_FIELDS),
    })
    .strict();
export type ListTenantsDto = z.infer<typeof listTenantsSchema>;
