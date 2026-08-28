import { Guard } from "../validation";

export interface PasswordResetTokenProps {
    id: string;
    tenantId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
}

export interface CreatePasswordResetTokenInput {
    tenantId: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}

/**
 * A single-use password-reset grant.
 *
 * Its own table rather than two nullable columns on User, so that consuming a
 * token is an explicit state transition that can be audited, and so an unused
 * token from last month does not sit indefinitely on the identity row.
 */
export class PasswordResetTokenEntity {
    private constructor(private props: PasswordResetTokenProps) {}

    static create(input: CreatePasswordResetTokenInput): PasswordResetTokenEntity {
        Guard.begin()
            .uuid("tenantId", input.tenantId)
            .uuid("userId", input.userId)
            .requiredString("tokenHash", input.tokenHash)
            .throwIfInvalid("PasswordResetToken");

        return new PasswordResetTokenEntity({
            id: "",
            tenantId: input.tenantId,
            userId: input.userId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt,
            usedAt: null,
            createdAt: new Date(),
        });
    }

    static rehydrate(props: PasswordResetTokenProps): PasswordResetTokenEntity {
        return new PasswordResetTokenEntity({ ...props });
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
    get expiresAt(): Date {
        return this.props.expiresAt;
    }
    get usedAt(): Date | null {
        return this.props.usedAt;
    }

    get isUsable(): boolean {
        return this.props.usedAt === null && this.props.expiresAt.getTime() > Date.now();
    }

    markUsed(at: Date = new Date()): this {
        this.props.usedAt = at;
        return this;
    }

    toPrimitives(): Readonly<PasswordResetTokenProps> {
        return { ...this.props };
    }
}
