import type { UserRole } from "../enums";

/**
 * Claims carried by an access token.
 *
 * `tenantId` is in the signed payload on purpose. Taking it from a header or
 * a subdomain instead means a client can change tenants by editing a request;
 * putting it in the token makes the tenant cryptographically bound to the
 * session.
 */
export interface AccessTokenClaims {
    /** User id. */
    sub: string;
    tenantId: string;
    roles: UserRole[];
    /**
     * Snapshot of the user's `credentialsChangedAt` in epoch milliseconds
     * (0 when credentials have never changed).
     *
     * This is what invalidates outstanding tokens after a password or email
     * change, and it is compared for EXACT equality on every request.
     *
     * The obvious alternative — comparing the token's `iat` against
     * `credentialsChangedAt` — is broken by JWT's one-second `iat`
     * resolution: a token minted in the same second as the change is
     * indistinguishable from one minted just before it, so the comparison is
     * either one second too strict (the token the user just received is
     * rejected, and they cannot sign in) or one second too lax (a token from
     * just before the change survives). An exact version has neither window.
     */
    credentialsVersion: number;
}

/** Verified claims, including the registered fields the adapter fills in. */
export interface VerifiedAccessToken extends AccessTokenClaims {
    /** Seconds since epoch. Informational — staleness uses `credentialsVersion`. */
    issuedAt: number;
    expiresAt: number;
}

export interface ITokenService {
    signAccessToken(claims: AccessTokenClaims, ttlSeconds?: number): Promise<string>;
    /** Throws `UnauthenticatedError` for anything malformed, expired or wrongly signed. */
    verifyAccessToken(token: string): Promise<VerifiedAccessToken>;
}
