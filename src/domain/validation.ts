import { ValidationError, type FieldIssue } from "./errors";

/**
 * Domain-level invariants.
 *
 * These are the rules that must hold for an entity to exist at all, in any
 * delivery mechanism. Project-specific input rules (an exact phone length, a
 * required job title) belong in the Zod DTOs at the edge, not here — otherwise
 * every project that clones this template has to edit the domain layer.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately permissive: 7-20 characters of digits with optional separators
// and an optional leading +. Tighten per country in the DTO, not here.
const PHONE_PATTERN = /^\+?[\d\s\-().]{7,20}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Guard {
    private readonly issues: FieldIssue[] = [];

    static begin(): Guard {
        return new Guard();
    }

    requiredString(field: string, value: string | undefined | null, minLength = 1): this {
        const trimmed = value?.trim() ?? "";
        if (trimmed.length < minLength) {
            this.issues.push({
                field,
                message:
                    minLength === 1
                        ? `${field} is required`
                        : `${field} must be at least ${minLength} characters`,
            });
        }
        return this;
    }

    maxLength(field: string, value: string | undefined | null, max: number): this {
        if (value != null && value.length > max) {
            this.issues.push({ field, message: `${field} must be at most ${max} characters` });
        }
        return this;
    }

    email(field: string, value: string | undefined | null): this {
        const trimmed = value?.trim() ?? "";
        if (!EMAIL_PATTERN.test(trimmed)) {
            this.issues.push({ field, message: `${field} must be a valid email address` });
        }
        return this;
    }

    phone(field: string, value: string | undefined | null): this {
        const trimmed = value?.trim() ?? "";
        if (!PHONE_PATTERN.test(trimmed)) {
            this.issues.push({ field, message: `${field} must be a valid phone number` });
        }
        return this;
    }

    slug(field: string, value: string | undefined | null): this {
        const trimmed = value?.trim() ?? "";
        if (!SLUG_PATTERN.test(trimmed)) {
            this.issues.push({
                field,
                message: `${field} must be lowercase alphanumeric words separated by hyphens`,
            });
        }
        return this;
    }

    nonEmptyArray(field: string, value: readonly unknown[] | undefined | null): this {
        if (!value || value.length === 0) {
            this.issues.push({ field, message: `${field} must contain at least one value` });
        }
        return this;
    }

    uuid(field: string, value: string | undefined | null): this {
        const trimmed = value?.trim() ?? "";
        if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                trimmed,
            )
        ) {
            this.issues.push({ field, message: `${field} must be a valid UUID` });
        }
        return this;
    }

    custom(condition: boolean, field: string, message: string): this {
        if (!condition) this.issues.push({ field, message });
        return this;
    }

    /** Throws a single ValidationError carrying every issue found, or returns. */
    throwIfInvalid(context: string): void {
        if (this.issues.length === 0) return;
        throw new ValidationError(`${context} is invalid`, this.issues);
    }
}

/** Canonical form used for storage and uniqueness comparisons. */
export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

/** Strips formatting so "+251 91-234 5678" and "+251912345678" are one value. */
export function normalizePhone(value: string): string {
    const trimmed = value.trim();
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return hasPlus ? `+${digits}` : digits;
}
