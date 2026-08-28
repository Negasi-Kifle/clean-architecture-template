import { ConflictError, DomainError, NotFoundError, ValidationError } from "../../domain/errors";

/**
 * Translates Prisma's error codes into domain errors.
 *
 * Why translate at all: the database is the only place that can enforce
 * uniqueness without a race. Application-level pre-checks narrow the window
 * but never close it, so the P2002 that slips through under concurrency has to
 * come back to the client as the same clean 409 as the pre-checked path — not
 * as a 500 with a constraint name in it.
 */

interface PrismaKnownError extends Error {
    code: string;
    meta?: Record<string, unknown>;
}

export function isPrismaKnownError(error: unknown): error is PrismaKnownError {
    return (
        error instanceof Error &&
        typeof (error as { code?: unknown }).code === "string" &&
        /^P\d{4}$/.test(String((error as { code?: unknown }).code))
    );
}

/** Best-effort recovery of the offending column(s) from Prisma's metadata. */
function extractField(error: PrismaKnownError): string | undefined {
    const meta = error.meta ?? {};

    const target = meta.target;
    if (Array.isArray(target) && target.length > 0) {
        return target.map(String).join(", ");
    }
    if (typeof target === "string" && target) {
        return stripConstraintSuffix(target);
    }

    const fieldName = meta.field_name;
    if (typeof fieldName === "string" && fieldName) {
        return stripConstraintSuffix(fieldName);
    }

    // Prisma 7 + driver adapters put the constraint under a nested cause.
    const constraint = (meta.driverAdapterError as { cause?: { constraint?: unknown } } | undefined)
        ?.cause?.constraint;
    if (constraint && typeof constraint === "object") {
        const fields = (constraint as { fields?: unknown }).fields;
        if (Array.isArray(fields) && fields.length > 0) return fields.map(String).join(", ");
        const index = (constraint as { index?: unknown }).index;
        if (typeof index === "string") return stripConstraintSuffix(index);
    }

    const quoted = /constraint:\s*`([^`]+)`/i.exec(error.message)?.[1];
    return quoted ? stripConstraintSuffix(quoted) : undefined;
}

/** "users_email_key" / "employees_branch_id_fkey" -> "email" / "branch_id". */
function stripConstraintSuffix(name: string): string {
    const base = name.replace(/_(key|fkey|idx|pkey)$/i, "");
    const match = /^[a-z][a-z0-9]*_(.+)$/i.exec(base);
    return match?.[1] ?? base;
}

/**
 * Postgres phrases the two directions of a foreign-key failure differently,
 * and they need opposite messages:
 *   "insert or update on table X" — the row you are writing points at nothing.
 *   "update or delete on table Y" — something still points at the row you are removing.
 */
function isDependencyBlocking(message: string): boolean {
    if (/insert or update on table/i.test(message)) return false;
    return /update or delete on table/i.test(message);
}

export function toDomainError(error: unknown): unknown {
    if (error instanceof DomainError) return error;
    if (!isPrismaKnownError(error)) return error;

    const field = extractField(error);

    switch (error.code) {
        case "P2002":
            return new ConflictError(
                field
                    ? `A record with this ${field} already exists`
                    : "A record with these values already exists",
                field,
            );

        case "P2003":
            return isDependencyBlocking(error.message)
                ? new ConflictError(
                      "Other records still reference this one. Remove or reassign them first.",
                      field,
                  )
                : new ValidationError("A referenced record does not exist", [
                      { field: field ?? "unknown", message: "Referenced record does not exist" },
                  ]);

        case "P2025":
            return new NotFoundError("Record");

        case "P2000":
            return new ValidationError("A value is too long for its column", [
                { field: field ?? "unknown", message: "Value exceeds the maximum length" },
            ]);

        default:
            return error;
    }
}

/** Wraps a repository call so callers only ever see domain errors. */
export async function mapPrismaErrors<T>(operation: () => Promise<T>): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        throw toDomainError(error);
    }
}
