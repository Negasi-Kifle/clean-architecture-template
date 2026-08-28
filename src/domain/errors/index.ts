export { DomainError } from "./domain.error";
export { NotFoundError } from "./not-found.error";
export { ConflictError } from "./conflict.error";
export { ValidationError, type FieldIssue } from "./validation.error";
export { BusinessRuleError } from "./business-rule.error";
export {
    InvalidCredentialsError,
    AccountInactiveError,
    UnauthenticatedError,
    ForbiddenError,
    InvalidRefreshTokenError,
    RefreshTokenReuseDetectedError,
    PasswordChangeRequiredError,
} from "./auth.errors";
export { TenantResolutionError, MissingTenantScopeError } from "./tenant.errors";
