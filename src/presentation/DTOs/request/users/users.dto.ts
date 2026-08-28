import { z } from "zod";
import { UserRole, UserType } from "../../../../domain/enums";
import {
    booleanQuery,
    dateQuery,
    emailSchema,
    nameSchema,
    paginationSchema,
    passwordSchema,
    phoneSchema,
    sortQuery,
} from "../common.dto";

export const USER_SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "firstName",
    "lastName",
    "email",
    "lastLoginAt",
] as const;

/**
 * `.strict()` everywhere on write payloads.
 *
 * Silently dropping unknown fields means a client that sends `isAdmin: true`
 * or misspells `phoneNumber` gets a 200 and no indication that the value was
 * ignored. Rejecting turns both into an immediate, obvious 400.
 */
export const createUserSchema = z
    .object({
        firstName: nameSchema,
        lastName: nameSchema,
        email: emailSchema,
        phoneNumber: phoneSchema,
        password: passwordSchema,
        roles: z.array(z.enum(UserRole)).min(1, "At least one role is required"),
        userType: z.enum(UserType).default(UserType.Employee),
        isActive: z.boolean().default(true),
        mustChangePassword: z.boolean().default(false),
    })
    .strict();
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
    .object({
        firstName: nameSchema.optional(),
        lastName: nameSchema.optional(),
        email: emailSchema.optional(),
        phoneNumber: phoneSchema.optional(),
        roles: z.array(z.enum(UserRole)).min(1).optional(),
        userType: z.enum(UserType).optional(),
        isActive: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

/** What a user may change about themselves. No roles, no isActive. */
export const updateMeSchema = z
    .object({
        firstName: nameSchema.optional(),
        lastName: nameSchema.optional(),
        email: emailSchema.optional(),
        phoneNumber: phoneSchema.optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export type UpdateMeDto = z.infer<typeof updateMeSchema>;

export const listUsersSchema = paginationSchema
    .extend({
        search: z.string().trim().min(1).max(100).optional(),
        email: z.string().trim().toLowerCase().optional(),
        phoneNumber: z.string().trim().optional(),
        // Repeatable query parameter: `?roles=Admin&roles=Member`. A bare
        // string is coerced to a single-element array so both forms work.
        roles: z
            .union([z.enum(UserRole), z.array(z.enum(UserRole))])
            .optional()
            .transform((value) =>
                value === undefined ? undefined : ([] as UserRole[]).concat(value),
            ),
        userType: z.enum(UserType).optional(),
        isActive: booleanQuery,
        includeDeleted: booleanQuery,
        createdFrom: dateQuery,
        createdTo: dateQuery,
        sort: sortQuery(USER_SORT_FIELDS),
    })
    .strict();
export type ListUsersDto = z.infer<typeof listUsersSchema>;
