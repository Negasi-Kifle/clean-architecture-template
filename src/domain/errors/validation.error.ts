import { DomainError } from "./domain.error";

export interface FieldIssue {
    /** Dot-separated path, e.g. "address.city" or "items.0.quantity". */
    field: string;
    message: string;
}

/**
 * Input failed validation.
 *
 * `issues` is field-level on purpose: a client rendering a form needs to know
 * WHICH field is wrong. Returning a single joined sentence — as is common —
 * forces the frontend to parse prose.
 */
export class ValidationError extends DomainError {
    readonly code = "VALIDATION_ERROR";

    constructor(
        message: string,
        readonly issues: FieldIssue[] = [],
    ) {
        super(message);
    }

    static forField(field: string, message: string): ValidationError {
        return new ValidationError(message, [{ field, message }]);
    }
}
