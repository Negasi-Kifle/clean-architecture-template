import { Guard } from "../validation";
import { BusinessRuleError } from "../errors";

export interface TenantProps {
    id: string;
    slug: string;
    name: string;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface CreateTenantInput {
    slug: string;
    name: string;
    isSystem?: boolean;
    isActive?: boolean;
}

export interface UpdateTenantInput {
    name?: string;
    isActive?: boolean;
}

/**
 * A tenant is the isolation boundary. In single-tenant mode exactly one
 * non-system tenant exists and every request resolves to it.
 */
export class TenantEntity {
    private constructor(private props: TenantProps) {}

    /**
     * Build a NEW tenant. Runs every invariant.
     *
     * `id` is absent because it is assigned by persistence — a draft entity is
     * a distinct thing from a persisted one, and conflating them is what forces
     * the `id ?? ""` placeholders that leak empty-string ids into queries.
     */
    static create(input: CreateTenantInput): TenantEntity {
        const slug = input.slug.trim().toLowerCase();

        Guard.begin()
            .slug("slug", slug)
            .requiredString("name", input.name, 2)
            .maxLength("name", input.name, 200)
            .throwIfInvalid("Tenant");

        const now = new Date();
        return new TenantEntity({
            id: "",
            slug,
            name: input.name.trim(),
            isSystem: input.isSystem ?? false,
            isActive: input.isActive ?? true,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        });
    }

    /**
     * Rebuild an entity from a persisted row.
     *
     * Critically, this does NOT re-run creation validation. Hydration that
     * validates means a row written under yesterday's rules throws on read —
     * the database is the source of truth for what already exists, and
     * tightening a rule must never make existing data unreadable.
     */
    static rehydrate(props: TenantProps): TenantEntity {
        return new TenantEntity({ ...props });
    }

    get id(): string {
        return this.props.id;
    }
    get slug(): string {
        return this.props.slug;
    }
    get name(): string {
        return this.props.name;
    }
    get isSystem(): boolean {
        return this.props.isSystem;
    }
    get isActive(): boolean {
        return this.props.isActive;
    }
    get createdAt(): Date {
        return this.props.createdAt;
    }
    get updatedAt(): Date {
        return this.props.updatedAt;
    }
    get deletedAt(): Date | null {
        return this.props.deletedAt;
    }
    get isDeleted(): boolean {
        return this.props.deletedAt !== null;
    }

    update(input: UpdateTenantInput): this {
        if (this.props.isSystem && input.isActive === false) {
            throw new BusinessRuleError("The platform tenant cannot be deactivated");
        }

        const name = input.name?.trim();
        if (name !== undefined) {
            Guard.begin()
                .requiredString("name", name, 2)
                .maxLength("name", name, 200)
                .throwIfInvalid("Tenant");
            this.props.name = name;
        }
        if (input.isActive !== undefined) this.props.isActive = input.isActive;

        this.props.updatedAt = new Date();
        return this;
    }

    softDelete(): this {
        if (this.props.isSystem) {
            throw new BusinessRuleError("The platform tenant cannot be deleted");
        }
        if (this.props.deletedAt) return this;
        this.props.deletedAt = new Date();
        this.props.isActive = false;
        this.props.updatedAt = new Date();
        return this;
    }

    toPrimitives(): Readonly<TenantProps> {
        return { ...this.props };
    }
}
