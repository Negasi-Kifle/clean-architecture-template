import { CredentialChangeReason, UserRole, UserType } from "../enums";
import { BusinessRuleError, ValidationError } from "../errors";
import { Guard, normalizeEmail, normalizePhone } from "../validation";

export interface UserProps {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    passwordHash: string;
    roles: UserRole[];
    userType: UserType;
    isActive: boolean;
    mustChangePassword: boolean;
    credentialsChangedAt: Date | null;
    credentialsChangedFor: CredentialChangeReason | null;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface CreateUserInput {
    tenantId: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    /** Already hashed. The domain never sees a plaintext password. */
    passwordHash: string;
    roles: UserRole[];
    userType?: UserType;
    isActive?: boolean;
    mustChangePassword?: boolean;
}

export interface UpdateUserInput {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    roles?: UserRole[];
    userType?: UserType;
    isActive?: boolean;
}

/**
 * Identity and credentials.
 *
 * Note what is NOT here: refresh tokens and password-reset tokens. Those are
 * session state with their own lifecycle and live in their own aggregates
 * (SessionEntity, PasswordResetTokenEntity). Hanging them off User as nullable
 * columns is what limits a user to one device and makes revocation impossible.
 */
export class UserEntity {
    private constructor(private props: UserProps) {}

    static create(input: CreateUserInput): UserEntity {
        const email = normalizeEmail(input.email);
        const phoneNumber = normalizePhone(input.phoneNumber);

        Guard.begin()
            .uuid("tenantId", input.tenantId)
            .requiredString("firstName", input.firstName, 2)
            .maxLength("firstName", input.firstName, 100)
            .requiredString("lastName", input.lastName, 2)
            .maxLength("lastName", input.lastName, 100)
            .email("email", email)
            .phone("phoneNumber", phoneNumber)
            .requiredString("passwordHash", input.passwordHash)
            .nonEmptyArray("roles", input.roles)
            .throwIfInvalid("User");

        const now = new Date();
        return new UserEntity({
            id: "",
            tenantId: input.tenantId,
            firstName: input.firstName.trim(),
            lastName: input.lastName.trim(),
            email,
            phoneNumber,
            passwordHash: input.passwordHash,
            roles: dedupeRoles(input.roles),
            userType: input.userType ?? UserType.Employee,
            isActive: input.isActive ?? true,
            mustChangePassword: input.mustChangePassword ?? false,
            credentialsChangedAt: null,
            credentialsChangedFor: null,
            lastLoginAt: null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        });
    }

    static rehydrate(props: UserProps): UserEntity {
        return new UserEntity({ ...props });
    }

    get id(): string {
        return this.props.id;
    }
    get tenantId(): string {
        return this.props.tenantId;
    }
    get firstName(): string {
        return this.props.firstName;
    }
    get lastName(): string {
        return this.props.lastName;
    }
    get fullName(): string {
        return `${this.props.firstName} ${this.props.lastName}`;
    }
    get email(): string {
        return this.props.email;
    }
    get phoneNumber(): string {
        return this.props.phoneNumber;
    }
    get passwordHash(): string {
        return this.props.passwordHash;
    }
    get roles(): readonly UserRole[] {
        return this.props.roles;
    }
    get userType(): UserType {
        return this.props.userType;
    }
    get isActive(): boolean {
        return this.props.isActive;
    }
    get mustChangePassword(): boolean {
        return this.props.mustChangePassword;
    }
    get credentialsChangedAt(): Date | null {
        return this.props.credentialsChangedAt;
    }
    get deletedAt(): Date | null {
        return this.props.deletedAt;
    }
    get isDeleted(): boolean {
        return this.props.deletedAt !== null;
    }

    hasRole(role: UserRole): boolean {
        return this.props.roles.includes(role);
    }

    hasAnyRole(roles: readonly UserRole[]): boolean {
        return roles.some((role) => this.props.roles.includes(role));
    }

    /** True when the account can authenticate at all. */
    canAuthenticate(): boolean {
        return this.props.isActive && this.props.deletedAt === null;
    }

    /**
     * The value stamped into an access token so it can later be checked
     * against the account's current state. Epoch milliseconds of the last
     * credential change, or 0 if there has never been one.
     */
    get credentialsVersion(): number {
        return this.props.credentialsChangedAt?.getTime() ?? 0;
    }

    /**
     * True when a token was minted before the most recent credential change
     * and must therefore be rejected.
     *
     * Exact equality against `credentialsVersion`, not a comparison against
     * the token's `iat`. `iat` has one-second resolution, which leaves no
     * correct threshold: `<=` rejects the token the user was just handed after
     * changing their password (they cannot sign in at all), and `<` lets a
     * token minted in the same second as the change survive it.
     *
     * This also replaces the "isCredentialUpdated" boolean flag pattern: no
     * write is needed on login to clear a flag, and every outstanding token is
     * invalidated at once rather than one at a time.
     */
    isTokenStale(tokenCredentialsVersion: number): boolean {
        return tokenCredentialsVersion !== this.credentialsVersion;
    }

    update(input: UpdateUserInput): this {
        const guard = Guard.begin();
        const email = input.email !== undefined ? normalizeEmail(input.email) : undefined;
        const phoneNumber =
            input.phoneNumber !== undefined ? normalizePhone(input.phoneNumber) : undefined;

        if (input.firstName !== undefined) {
            guard
                .requiredString("firstName", input.firstName, 2)
                .maxLength("firstName", input.firstName, 100);
        }
        if (input.lastName !== undefined) {
            guard
                .requiredString("lastName", input.lastName, 2)
                .maxLength("lastName", input.lastName, 100);
        }
        if (email !== undefined) guard.email("email", email);
        if (phoneNumber !== undefined) guard.phone("phoneNumber", phoneNumber);
        if (input.roles !== undefined) guard.nonEmptyArray("roles", input.roles);
        guard.throwIfInvalid("User");

        if (input.firstName !== undefined) this.props.firstName = input.firstName.trim();
        if (input.lastName !== undefined) this.props.lastName = input.lastName.trim();
        if (email !== undefined && email !== this.props.email) {
            this.props.email = email;
            this.markCredentialsChanged(CredentialChangeReason.Email);
        }
        if (phoneNumber !== undefined) this.props.phoneNumber = phoneNumber;
        if (input.roles !== undefined) this.props.roles = dedupeRoles(input.roles);
        if (input.userType !== undefined) this.props.userType = input.userType;
        if (input.isActive !== undefined) this.props.isActive = input.isActive;

        this.props.updatedAt = new Date();
        return this;
    }

    changePassword(newPasswordHash: string, reason = CredentialChangeReason.Password): this {
        if (!newPasswordHash.trim()) {
            throw ValidationError.forField("passwordHash", "passwordHash is required");
        }
        this.props.passwordHash = newPasswordHash;
        this.props.mustChangePassword = false;
        this.markCredentialsChanged(reason);
        this.props.updatedAt = new Date();
        return this;
    }

    requirePasswordChange(): this {
        this.props.mustChangePassword = true;
        this.props.updatedAt = new Date();
        return this;
    }

    recordLogin(at: Date = new Date()): this {
        this.props.lastLoginAt = at;
        return this;
    }

    deactivate(): this {
        this.props.isActive = false;
        // Kill outstanding access tokens immediately rather than waiting for
        // them to expire on their own.
        this.markCredentialsChanged(CredentialChangeReason.AdminReset);
        this.props.updatedAt = new Date();
        return this;
    }

    activate(): this {
        this.props.isActive = true;
        this.props.updatedAt = new Date();
        return this;
    }

    softDelete(): this {
        if (this.props.deletedAt) return this;
        if (this.hasRole(UserRole.PlatformAdmin)) {
            throw new BusinessRuleError(
                "Platform administrators cannot be deleted through the API",
            );
        }
        this.props.deletedAt = new Date();
        this.props.isActive = false;
        this.markCredentialsChanged(CredentialChangeReason.AdminReset);
        this.props.updatedAt = new Date();
        return this;
    }

    private markCredentialsChanged(reason: CredentialChangeReason): void {
        this.props.credentialsChangedAt = new Date();
        this.props.credentialsChangedFor = reason;
    }

    toPrimitives(): Readonly<UserProps> {
        return { ...this.props, roles: [...this.props.roles] };
    }
}

function dedupeRoles(roles: readonly UserRole[]): UserRole[] {
    return [...new Set(roles)];
}
