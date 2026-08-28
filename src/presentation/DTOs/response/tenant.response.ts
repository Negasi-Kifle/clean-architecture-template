import type { TenantEntity } from "../../../domain/entities";

export interface TenantResponse {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export function toTenantResponse(tenant: TenantEntity): TenantResponse {
    const p = tenant.toPrimitives();
    return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    };
}
