import type {
    UserRole as PrismaUserRole,
    UserType as PrismaUserType,
    CredentialChangeReason as PrismaCredentialChangeReason,
} from "../generated/client";
import type { UserRole, UserType, CredentialChangeReason } from "../../../domain/enums";

/**
 * Compile-time proof that the domain enums and the Prisma enums have identical
 * members.
 *
 * The domain must not import Prisma's generated types — that would put an
 * infrastructure dependency in the innermost layer. The cost of duplicating
 * the enum is drift: rename a member in the schema and the casts in the
 * mappers keep compiling while producing values the database rejects at
 * runtime. These assertions turn that into a build failure.
 *
 * `${Enum}` widens a TypeScript string enum to the union of its string values,
 * which is what Prisma generates. Both directions are asserted, so a member
 * added on either side — not just renamed — breaks the build.
 *
 * IF A LINE BELOW STOPS COMPILING: a schema enum and its domain twin have
 * diverged. Fix both. Do not widen the type or delete the assertion.
 */

type Assert<T extends true> = T;
type Covers<Superset, Subset> = [Subset] extends [Superset] ? true : false;

export type _UserRoleCoversPrisma = Assert<Covers<`${UserRole}`, PrismaUserRole>>;
export type _PrismaCoversUserRole = Assert<Covers<PrismaUserRole, `${UserRole}`>>;

export type _UserTypeCoversPrisma = Assert<Covers<`${UserType}`, PrismaUserType>>;
export type _PrismaCoversUserType = Assert<Covers<PrismaUserType, `${UserType}`>>;

export type _ReasonCoversPrisma = Assert<
    Covers<`${CredentialChangeReason}`, PrismaCredentialChangeReason>
>;
export type _PrismaCoversReason = Assert<
    Covers<PrismaCredentialChangeReason, `${CredentialChangeReason}`>
>;
