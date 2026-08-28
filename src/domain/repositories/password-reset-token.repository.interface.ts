import type { PasswordResetTokenEntity } from "../entities";

export interface IPasswordResetTokenRepository {
    create(token: PasswordResetTokenEntity): Promise<PasswordResetTokenEntity>;
    /** Cross-tenant: the tenant is unknown until the token resolves to a user. */
    findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null>;
    markUsed(id: string): Promise<void>;
    /** Invalidates outstanding grants when a new one is issued. */
    invalidateAllForUser(userId: string): Promise<number>;
}
