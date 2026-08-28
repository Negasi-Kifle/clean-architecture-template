import { Guard } from "../validation";

export interface BranchProps {
    id: string;
    tenantId: string;
    name: string;
    code: string | null;
    description: string | null;
    street: string | null;
    city: string | null;
    state: string | null;
    zipCode: string | null;
    country: string | null;
    phoneNumber: string | null;
    email: string | null;
    mapsUrl: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

export interface CreateBranchInput {
    tenantId: string;
    name: string;
    code?: string | null;
    description?: string | null;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
    mapsUrl?: string | null;
    isActive?: boolean;
}

export type UpdateBranchInput = Partial<Omit<CreateBranchInput, "tenantId">>;

const MAX_URL_LENGTH = 2048;

export class BranchEntity {
    private constructor(private props: BranchProps) {}

    static create(input: CreateBranchInput): BranchEntity {
        const guard = Guard.begin()
            .uuid("tenantId", input.tenantId)
            .requiredString("name", input.name)
            .maxLength("name", input.name, 200)
            .maxLength("mapsUrl", input.mapsUrl, MAX_URL_LENGTH);

        if (input.email) guard.email("email", input.email);
        if (input.phoneNumber) guard.phone("phoneNumber", input.phoneNumber);
        guard.throwIfInvalid("Branch");

        const now = new Date();
        return new BranchEntity({
            id: "",
            tenantId: input.tenantId,
            name: input.name.trim(),
            code: input.code?.trim().toUpperCase() ?? null,
            description: input.description ?? null,
            street: input.street ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
            zipCode: input.zipCode ?? null,
            country: input.country ?? null,
            phoneNumber: input.phoneNumber?.trim() ?? null,
            email: input.email?.trim().toLowerCase() ?? null,
            mapsUrl: input.mapsUrl ?? null,
            isActive: input.isActive ?? true,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
        });
    }

    static rehydrate(props: BranchProps): BranchEntity {
        return new BranchEntity({ ...props });
    }

    get id(): string {
        return this.props.id;
    }
    get tenantId(): string {
        return this.props.tenantId;
    }
    get name(): string {
        return this.props.name;
    }
    get code(): string | null {
        return this.props.code;
    }
    get isActive(): boolean {
        return this.props.isActive;
    }
    get deletedAt(): Date | null {
        return this.props.deletedAt;
    }

    update(input: UpdateBranchInput): this {
        const guard = Guard.begin();
        if (input.name !== undefined) {
            guard.requiredString("name", input.name).maxLength("name", input.name, 200);
        }
        if (input.email) guard.email("email", input.email);
        if (input.phoneNumber) guard.phone("phoneNumber", input.phoneNumber);
        if (input.mapsUrl) guard.maxLength("mapsUrl", input.mapsUrl, MAX_URL_LENGTH);
        guard.throwIfInvalid("Branch");

        // `undefined` means "not supplied, leave alone"; `null` means
        // "explicitly clear this field". Collapsing the two is why partial
        // updates silently fail to clear values.
        if (input.name !== undefined) this.props.name = input.name.trim();
        if (input.code !== undefined) this.props.code = input.code?.trim().toUpperCase() ?? null;
        if (input.description !== undefined) this.props.description = input.description ?? null;
        if (input.street !== undefined) this.props.street = input.street ?? null;
        if (input.city !== undefined) this.props.city = input.city ?? null;
        if (input.state !== undefined) this.props.state = input.state ?? null;
        if (input.zipCode !== undefined) this.props.zipCode = input.zipCode ?? null;
        if (input.country !== undefined) this.props.country = input.country ?? null;
        if (input.phoneNumber !== undefined) {
            this.props.phoneNumber = input.phoneNumber?.trim() ?? null;
        }
        if (input.email !== undefined) {
            this.props.email = input.email?.trim().toLowerCase() ?? null;
        }
        if (input.mapsUrl !== undefined) this.props.mapsUrl = input.mapsUrl ?? null;
        if (input.isActive !== undefined) this.props.isActive = input.isActive;

        this.props.updatedAt = new Date();
        return this;
    }

    softDelete(): this {
        if (this.props.deletedAt) return this;
        this.props.deletedAt = new Date();
        this.props.isActive = false;
        this.props.updatedAt = new Date();
        return this;
    }

    toPrimitives(): Readonly<BranchProps> {
        return { ...this.props };
    }
}
