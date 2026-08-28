import type { Tenant } from "../generated/client";
import { TenantEntity } from "../../../domain/entities";

export function toTenantEntity(row: Tenant): TenantEntity {
    return TenantEntity.rehydrate({
        id: row.id,
        slug: row.slug,
        name: row.name,
        isSystem: row.isSystem,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
    });
}

/** Create payload. `id` is omitted so the database assigns it. */
export function toTenantCreateData(entity: TenantEntity) {
    const props = entity.toPrimitives();
    return {
        slug: props.slug,
        name: props.name,
        isSystem: props.isSystem,
        isActive: props.isActive,
    };
}

/** Update payload — only the mutable columns, so a stale entity cannot clobber timestamps. */
export function toTenantUpdateData(entity: TenantEntity) {
    const props = entity.toPrimitives();
    return {
        name: props.name,
        isActive: props.isActive,
        deletedAt: props.deletedAt,
    };
}
