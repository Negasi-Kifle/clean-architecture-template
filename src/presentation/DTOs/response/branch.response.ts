import type { BranchEntity } from "../../../domain/entities";

export interface BranchResponse {
    id: string;
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
    createdAt: string;
    updatedAt: string;
}

export function toBranchResponse(branch: BranchEntity): BranchResponse {
    const p = branch.toPrimitives();
    return {
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        street: p.street,
        city: p.city,
        state: p.state,
        zipCode: p.zipCode,
        country: p.country,
        phoneNumber: p.phoneNumber,
        email: p.email,
        mapsUrl: p.mapsUrl,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}
