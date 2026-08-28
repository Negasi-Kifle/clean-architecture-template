import type { Branch } from "../generated/client";
import { BranchEntity } from "../../../domain/entities";
import type { BranchSummary } from "../../../domain/projections";

export function toBranchEntity(row: Branch): BranchEntity {
    return BranchEntity.rehydrate({
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        code: row.code,
        description: row.description,
        street: row.street,
        city: row.city,
        state: row.state,
        zipCode: row.zipCode,
        country: row.country,
        phoneNumber: row.phoneNumber,
        email: row.email,
        mapsUrl: row.mapsUrl,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
    });
}

/** Columns selected when a branch is embedded in another read. */
export const branchSummarySelect = {
    id: true,
    name: true,
    code: true,
    city: true,
    country: true,
    isActive: true,
} as const;

export type BranchSummaryRow = {
    id: string;
    name: string;
    code: string | null;
    city: string | null;
    country: string | null;
    isActive: boolean;
};

export function toBranchSummary(row: BranchSummaryRow): BranchSummary {
    return {
        id: row.id,
        name: row.name,
        code: row.code,
        city: row.city,
        country: row.country,
        isActive: row.isActive,
    };
}

export function toBranchCreateData(entity: BranchEntity) {
    const p = entity.toPrimitives();
    return {
        tenantId: p.tenantId,
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
    };
}

export function toBranchUpdateData(entity: BranchEntity) {
    const p = entity.toPrimitives();
    return {
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
        deletedAt: p.deletedAt,
    };
}
