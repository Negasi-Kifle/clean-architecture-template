import { DomainError } from "./domain.error";

/** Wrong email/phone or wrong password. Deliberately indistinguishable — see the use case. */
export class InvalidCredentialsError extends DomainError {
    readonly code = "INVALID_CREDENTIALS";

    constructor(message = "Invalid credentials") {
        super(message);
    }
}

/** The account exists and the password is right, but the account is disabled. */
export class AccountInactiveError extends DomainError {
    readonly code = "ACCOUNT_INACTIVE";

    constructor(message = "This account has been deactivated") {
        super(message);
    }
}

/** Access token is missing, malformed, expired, or was issued before a credential change. */
export class UnauthenticatedError extends DomainError {
    readonly code = "UNAUTHENTICATED";

    constructor(message = "Authentication required") {
        super(message);
    }
}

/** Authenticated, but not permitted to perform this operation. */
export class ForbiddenError extends DomainError {
    readonly code = "FORBIDDEN";

    constructor(message = "You do not have permission to perform this action") {
        super(message);
    }
}

/** Refresh token is unknown, expired or already revoked. */
export class InvalidRefreshTokenError extends DomainError {
    readonly code = "INVALID_REFRESH_TOKEN";

    constructor(message = "Refresh token is invalid or has expired") {
        super(message);
    }
}

/**
 * A refresh token that had already been rotated was presented again.
 *
 * This is the single strongest signal that a token was stolen: the legitimate
 * client and the attacker are both holding tokens from the same family. The
 * only safe response is to revoke the whole family and force a fresh login.
 */
export class RefreshTokenReuseDetectedError extends DomainError {
    readonly code = "REFRESH_TOKEN_REUSE_DETECTED";

    constructor(
        message = "This session has been terminated for security reasons. Please sign in again.",
    ) {
        super(message);
    }
}

/** The user must set a new password before doing anything else. */
export class PasswordChangeRequiredError extends DomainError {
    readonly code = "PASSWORD_CHANGE_REQUIRED";

    constructor(message = "You must change your password before continuing") {
        super(message);
    }
}
