import { z } from "zod";
import { emailSchema, passwordSchema } from "../common.dto";

export const loginSchema = z
    .object({
        /** Email or phone number. */
        identifier: z.string().trim().min(3, "Email or phone number is required").max(254),
        // NOT validated against the password policy: an existing account may
        // predate the current rules, and rejecting a login for a weak password
        // would also confirm the policy to an attacker.
        password: z.string().min(1, "Password is required").max(128),
    })
    .strict();
export type LoginDto = z.infer<typeof loginSchema>;

export const refreshTokenSchema = z
    .object({ refreshToken: z.string().min(1, "Refresh token is required") })
    .strict();
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;

export const logoutSchema = refreshTokenSchema;
export type LogoutDto = z.infer<typeof logoutSchema>;

export const changePasswordSchema = z
    .object({
        currentPassword: z.string().min(1, "Current password is required"),
        newPassword: passwordSchema,
    })
    .strict()
    .refine((data) => data.currentPassword !== data.newPassword, {
        path: ["newPassword"],
        message: "New password must be different from the current password",
    });
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
    .object({
        token: z.string().min(1, "Reset token is required"),
        newPassword: passwordSchema,
    })
    .strict();
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const verifyResetTokenSchema = z
    .object({ token: z.string().min(1, "Reset token is required") })
    .strict();
export type VerifyResetTokenDto = z.infer<typeof verifyResetTokenSchema>;
