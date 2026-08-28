import { DomainError } from "./domain.error";

/** A requested entity does not exist, or is not visible to the caller's tenant. */
export class NotFoundError extends DomainError {
    readonly code = "NOT_FOUND";

    constructor(
        readonly entity: string,
        readonly identifier?: string,
    ) {
        super(identifier ? `${entity} not found: ${identifier}` : `${entity} not found`);
    }
}
