import type { QueryOptions } from "../../domain/interfaces";
import type {
    BranchFilters,
    BranchSortField,
    EmployeeFilters,
    EmployeeSortField,
    TenantFilters,
    TenantSortField,
    UserFilters,
    UserSortField,
} from "../../domain/repositories";
import type { ListUsersDto } from "../DTOs/request/users";
import type { ListEmployeesDto } from "../DTOs/request/employees";
import type { ListBranchesDto } from "../DTOs/request/branches";
import type { ListTenantsDto } from "../DTOs/request/tenants";
import { toPagination } from "./pagination.mapper";

/**
 * Translate validated list DTOs into repository query options.
 *
 * This is the boundary where HTTP vocabulary (page, limit, `?sort=-createdAt`)
 * becomes persistence vocabulary (skip, take, orderBy). Keeping it in one
 * direction — HTTP knows about the domain, never the reverse — is what lets a
 * use case be driven from a queue consumer or a CLI without an HTTP request
 * anywhere in sight.
 */

export function toUserQueryOptions(dto: ListUsersDto): QueryOptions<UserFilters, UserSortField> {
    return {
        pagination: toPagination(dto),
        sort: dto.sort,
        filters: {
            ...(dto.search !== undefined && { search: dto.search }),
            ...(dto.email !== undefined && { email: dto.email }),
            ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
            ...(dto.roles !== undefined && { roles: dto.roles }),
            ...(dto.userType !== undefined && { userType: dto.userType }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.includeDeleted !== undefined && { includeDeleted: dto.includeDeleted }),
            ...(dto.createdFrom !== undefined && { createdFrom: dto.createdFrom }),
            ...(dto.createdTo !== undefined && { createdTo: dto.createdTo }),
        },
    };
}

export function toEmployeeQueryOptions(
    dto: ListEmployeesDto,
): QueryOptions<EmployeeFilters, EmployeeSortField> {
    return {
        pagination: toPagination(dto),
        sort: dto.sort,
        filters: {
            ...(dto.search !== undefined && { search: dto.search }),
            // `null` is meaningful here (unassigned), so the presence check is
            // `!== undefined` rather than a truthiness test.
            ...(dto.branchId !== undefined && { branchId: dto.branchId }),
            ...(dto.employeeNumber !== undefined && { employeeNumber: dto.employeeNumber }),
            ...(dto.jobTitle !== undefined && { jobTitle: dto.jobTitle }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.includeDeleted !== undefined && { includeDeleted: dto.includeDeleted }),
        },
    };
}

export function toBranchQueryOptions(
    dto: ListBranchesDto,
): QueryOptions<BranchFilters, BranchSortField> {
    return {
        pagination: toPagination(dto),
        sort: dto.sort,
        filters: {
            ...(dto.search !== undefined && { search: dto.search }),
            ...(dto.code !== undefined && { code: dto.code }),
            ...(dto.city !== undefined && { city: dto.city }),
            ...(dto.country !== undefined && { country: dto.country }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.includeDeleted !== undefined && { includeDeleted: dto.includeDeleted }),
        },
    };
}

export function toTenantQueryOptions(
    dto: ListTenantsDto,
): QueryOptions<TenantFilters, TenantSortField> {
    return {
        pagination: toPagination(dto),
        sort: dto.sort,
        filters: {
            ...(dto.search !== undefined && { search: dto.search }),
            ...(dto.slug !== undefined && { slug: dto.slug }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            ...(dto.includeDeleted !== undefined && { includeDeleted: dto.includeDeleted }),
        },
    };
}
