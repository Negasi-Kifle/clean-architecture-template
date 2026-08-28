import type { UserEntity } from "../../../domain/entities";
import type { UserRole, UserType } from "../../../domain/enums";

/**
 * The public shape of a user.
 *
 * Built field by field rather than by spreading the entity. A spread would
 * carry `passwordHash` out to the client the moment someone adds it to the
 * props — the explicit list is what makes that impossible.
 */
export interface UserResponse {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    roles: UserRole[];
    userType: UserType;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export function toUserResponse(user: UserEntity): UserResponse {
    const p = user.toPrimitives();
    return {
        id: p.id,
        tenantId: p.tenantId,
        firstName: p.firstName,
        lastName: p.lastName,
        fullName: user.fullName,
        email: p.email,
        phoneNumber: p.phoneNumber,
        roles: p.roles,
        userType: p.userType,
        isActive: p.isActive,
        mustChangePassword: p.mustChangePassword,
        lastLoginAt: p.lastLoginAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}
