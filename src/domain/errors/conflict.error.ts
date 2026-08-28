import { DomainError } from "./domain.error";

/** The write would violate a uniqueness or state constraint. */
export class ConflictError extends DomainError {
    readonly code = "CONFLICT";

    constructor(
        message: string,
        readonly field?: string,
    ) {
        super(message);
    }
}
