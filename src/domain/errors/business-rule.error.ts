import { DomainError } from "./domain.error";

/**
 * A domain invariant forbids this operation, even though the input is
 * well-formed and the entity exists. Example: deleting the last remaining
 * tenant administrator.
 */
export class BusinessRuleError extends DomainError {
    readonly code = "BUSINESS_RULE_VIOLATION";

    constructor(message: string) {
        super(message);
    }
}
