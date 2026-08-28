import { Guard } from "../validation";

export interface SessionProps {
    id: string;
    tenantId: string;
    userId: string;
    /** SHA-256 of the opaque refresh token. The plaintext is never stored. */
    refreshTokenHash: string;
    /** Shared by every rotation of one login. The unit of revocation. */
    familyId: string;
    userAgent: string | null;
    ipAddress: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    revokedReason: string | null;
    createdAt: Date;
}

export interface CreateSessionInput {
    tenantId: string;
    userId: string;
    refreshTokenHash: string;
    familyId: string;
    userAgent?: string | null;
    ipAddress?: string | null;
    expiresAt: Date;
}

export const SessionRevocationReason = {
    ROTATED: "rotated",
    LOGOUT: "logout",
    LOGOUT_ALL: "logout_all",
    REUSE_DETECTED: "reuse_detected",
    CREDENTIALS_CHANGED: "credentials_changed",
} as const;

export type SessionRevocationReasonValue =
    (typeof SessionRevocationReason)[keyof typeof SessionRevocationReason];

/** One refresh token in one login's rotation chain. */
export class SessionEntity {
    private constructor(private props: SessionProps) {}

    static create(input: CreateSessionInput): SessionEntity {
        Guard.begin()
            .uuid("tenantId", input.tenantId)
            .uuid("userId", input.userId)
            .requiredString("refreshTokenHash", input.refreshTokenHash)
            .uuid("familyId", input.familyId)
            .custom(
                input.expiresAt.getTime() > Date.now(),
                "expiresAt",
                "expiresAt must be in the future",
            )
            .throwIfInvalid("Session");

        return new SessionEntity({
            id: "",
            tenantId: input.tenantId,
            userId: input.userId,
            refreshTokenHash: input.refreshTokenHash,
            familyId: input.familyId,
            userAgent: input.userAgent?.slice(0, 512) ?? null,
            ipAddress: input.ipAddress ?? null,
            expiresAt: input.expiresAt,
            revokedAt: null,
            revokedReason: null,
            createdAt: new Date(),
        });
    }

    static rehydrate(props: SessionProps): SessionEntity {
        return new SessionEntity({ ...props });
    }

    get id(): string {
        return this.props.id;
    }
    get tenantId(): string {
        return this.props.tenantId;
    }
    get userId(): string {
        return this.props.userId;
    }
    get familyId(): string {
        return this.props.familyId;
    }
    get expiresAt(): Date {
        return this.props.expiresAt;
    }
    get revokedAt(): Date | null {
        return this.props.revokedAt;
    }
    get revokedReason(): string | null {
        return this.props.revokedReason;
    }
    get userAgent(): string | null {
        return this.props.userAgent;
    }
    get ipAddress(): string | null {
        return this.props.ipAddress;
    }
    get createdAt(): Date {
        return this.props.createdAt;
    }

    get isExpired(): boolean {
        return this.props.expiresAt.getTime() <= Date.now();
    }
    get isRevoked(): boolean {
        return this.props.revokedAt !== null;
    }
    get isUsable(): boolean {
        return !this.isRevoked && !this.isExpired;
    }

    revoke(reason: SessionRevocationReasonValue, at: Date = new Date()): this {
        if (this.props.revokedAt) return this;
        this.props.revokedAt = at;
        this.props.revokedReason = reason;
        return this;
    }

    toPrimitives(): Readonly<SessionProps> {
        return { ...this.props };
    }
}
