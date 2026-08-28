import type { User } from "../generated/client";
import { UserEntity } from "../../../domain/entities";
import type { CredentialChangeReason, UserRole, UserType } from "../../../domain/enums";
import type { UserSummary } from "../../../domain/projections";

export function toUserEntity(row: User): UserEntity {
    return UserEntity.rehydrate({
        id: row.id,
        tenantId: row.tenantId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phoneNumber: row.phoneNumber,
        passwordHash: row.passwordHash,
        roles: row.roles as UserRole[],
        userType: row.userType as UserType,
        isActive: row.isActive,
        mustChangePassword: row.mustChangePassword,
        credentialsChangedAt: row.credentialsChangedAt,
        credentialsChangedFor: row.credentialsChangedFor as CredentialChangeReason | null,
        lastLoginAt: row.lastLoginAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
    });
}

/**
 * Columns selected when a user is embedded in another read.
 *
 * `passwordHash` is absent, and the projection TYPE has no such field, so an
 * accidental leak through an include is a compile error rather than something
 * a reviewer has to catch.
 */
export const userSummarySelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    phoneNumber: true,
    isActive: true,
} as const;

export type UserSummaryRow = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    isActive: boolean;
};

export function toUserSummary(row: UserSummaryRow): UserSummary {
    return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phoneNumber: row.phoneNumber,
        isActive: row.isActive,
    };
}

export function toUserCreateData(entity: UserEntity) {
    const p = entity.toPrimitives();
    return {
        tenantId: p.tenantId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phoneNumber: p.phoneNumber,
        passwordHash: p.passwordHash,
        roles: p.roles,
        userType: p.userType,
        isActive: p.isActive,
        mustChangePassword: p.mustChangePassword,
    };
}

export function toUserUpdateData(entity: UserEntity) {
    const p = entity.toPrimitives();
    return {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phoneNumber: p.phoneNumber,
        passwordHash: p.passwordHash,
        roles: p.roles,
        userType: p.userType,
        isActive: p.isActive,
        mustChangePassword: p.mustChangePassword,
        credentialsChangedAt: p.credentialsChangedAt,
        credentialsChangedFor: p.credentialsChangedFor,
        lastLoginAt: p.lastLoginAt,
        deletedAt: p.deletedAt,
    };
}
