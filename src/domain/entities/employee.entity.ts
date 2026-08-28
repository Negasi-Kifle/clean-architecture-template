import { Guard } from "../validation";
import type { BranchSummary } from "../projections";
import type { UserSummary } from "../projections";

export interface EmployeeProps {
    id: string;
    tenantId: string;
    userId: string;
    /** Null when unassigned, or when the product runs with BRANCHES_ENABLED=false. */
    branchId: string | null;
    employeeNumber: string | null;
    jobTitle: string | null;
    hireDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface CreateEmployeeInput {
    tenantId: string;
    /** Optional only while inside the create-user-and-employee transaction. */
    userId?: string;
    branchId?: string | null;
    employeeNumber?: string | null;
    jobTitle?: string | null;
    hireDate?: Date | null;
}

export interface UpdateEmployeeInput {
    branchId?: string | null;
    employeeNumber?: string | null;
    jobTitle?: string | null;
    hireDate?: Date | null;
}

/**
 * Staff profile attached to a User.
 *
 * `user` and `branch` are read-only projections filled by list/detail reads.
 * They are never persisted from here and never carry a password hash — the
 * projection types make that a compile-time guarantee rather than a convention.
 */
export class EmployeeEntity {
    private constructor(
        private props: EmployeeProps,
        private readonly relations: { user?: UserSummary; branch?: BranchSummary | null } = {},
    ) {}

    static create(input: CreateEmployeeInput): EmployeeEntity {
        const guard = Guard.begin().uuid("tenantId", input.tenantId);
        if (input.userId) guard.uuid("userId", input.userId);
        if (input.branchId) guard.uuid("branchId", input.branchId);
        guard.throwIfInvalid("Employee");

        const now = new Date();
        return new EmployeeEntity({
            id: "",
            tenantId: input.tenantId,
            userId: input.userId ?? "",
            branchId: input.branchId ?? null,
            employeeNumber: input.employeeNumber?.trim() || null,
            jobTitle: input.jobTitle?.trim() || null,
            hireDate: input.hireDate ?? null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        });
    }

    static rehydrate(
        props: EmployeeProps,
        relations: { user?: UserSummary; branch?: BranchSummary | null } = {},
    ): EmployeeEntity {
        return new EmployeeEntity({ ...props }, relations);
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
    get branchId(): string | null {
        return this.props.branchId;
    }
    get employeeNumber(): string | null {
        return this.props.employeeNumber;
    }
    get jobTitle(): string | null {
        return this.props.jobTitle;
    }
    get hireDate(): Date | null {
        return this.props.hireDate;
    }
    get deletedAt(): Date | null {
        return this.props.deletedAt;
    }
    get user(): UserSummary | undefined {
        return this.relations.user;
    }
    get branch(): BranchSummary | null | undefined {
        return this.relations.branch;
    }

    /** Called by the repository once the User row exists inside the transaction. */
    attachUser(userId: string): this {
        Guard.begin().uuid("userId", userId).throwIfInvalid("Employee");
        this.props.userId = userId;
        return this;
    }

    update(input: UpdateEmployeeInput): this {
        const guard = Guard.begin();
        if (input.branchId) guard.uuid("branchId", input.branchId);
        guard.throwIfInvalid("Employee");

        if (input.branchId !== undefined) this.props.branchId = input.branchId ?? null;
        if (input.employeeNumber !== undefined) {
            this.props.employeeNumber = input.employeeNumber?.trim() || null;
        }
        if (input.jobTitle !== undefined) this.props.jobTitle = input.jobTitle?.trim() || null;
        if (input.hireDate !== undefined) this.props.hireDate = input.hireDate ?? null;

        this.props.updatedAt = new Date();
        return this;
    }

    softDelete(): this {
        if (this.props.deletedAt) return this;
        this.props.deletedAt = new Date();
        this.props.updatedAt = new Date();
        return this;
    }

    toPrimitives(): Readonly<EmployeeProps> {
        return { ...this.props };
    }
}
