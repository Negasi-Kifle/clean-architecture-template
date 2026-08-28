import { z } from "zod";
import { UserRole } from "../../../../domain/enums";
import {
    booleanQuery,
    emailSchema,
    nameSchema,
    paginationSchema,
    passwordSchema,
    phoneSchema,
    sortQuery,
} from "../common.dto";

export const EMPLOYEE_SORT_FIELDS = [
    "createdAt",
    "updatedAt",
    "employeeNumber",
    "hireDate",
] as const;

export const createEmployeeSchema = z
    .object({
        firstName: nameSchema,
        lastName: nameSchema,
        email: emailSchema,
        phoneNumber: phoneSchema,
        roles: z.array(z.enum(UserRole)).min(1, "At least one role is required"),
        /**
         * Optional. When omitted the API generates one and returns it exactly
         * once in the response — never a shared default, and never written to
         * a log.
         */
        password: passwordSchema.optional(),
        branchId: z.uuid("branchId must be a valid UUID").nullable().optional(),
        employeeNumber: z.string().trim().max(50).nullable().optional(),
        jobTitle: z.string().trim().max(120).nullable().optional(),
        hireDate: z.coerce.date().nullable().optional(),
        isActive: z.boolean().default(true),
    })
    .strict();
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
    .object({
        branchId: z.uuid("branchId must be a valid UUID").nullable().optional(),
        employeeNumber: z.string().trim().max(50).nullable().optional(),
        jobTitle: z.string().trim().max(120).nullable().optional(),
        hireDate: z.coerce.date().nullable().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, "Provide at least one field to update");
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;

export const listEmployeesSchema = paginationSchema
    .extend({
        search: z.string().trim().min(1).max(100).optional(),
        /**
         * `?branchId=unassigned` filters for employees with no branch.
         * A bare `?branchId=` would be an empty string, which is neither a
         * valid UUID nor an unambiguous request for null.
         */
        branchId: z
            .union([z.literal("unassigned"), z.uuid()])
            .optional()
            .transform((value) =>
                value === undefined ? undefined : value === "unassigned" ? null : value,
            ),
        employeeNumber: z.string().trim().optional(),
        jobTitle: z.string().trim().optional(),
        isActive: booleanQuery,
        includeDeleted: booleanQuery,
        sort: sortQuery(EMPLOYEE_SORT_FIELDS),
    })
    .strict();
export type ListEmployeesDto = z.infer<typeof listEmployeesSchema>;

export const deleteEmployeeQuerySchema = z.object({ deactivateUser: booleanQuery }).strict();
export type DeleteEmployeeQueryDto = z.infer<typeof deleteEmployeeQuerySchema>;
