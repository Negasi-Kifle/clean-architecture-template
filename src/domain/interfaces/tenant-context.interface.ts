/**
 * The authenticated principal, as every layer above the repository sees it.
 *
 * Built once by the auth middleware from verified JWT claims. Nothing here is
 * client-supplied: `tenantId` in particular comes off the signed token, never
 * off a header, so a client cannot switch tenants by editing a request.
 */
export interface AuthenticatedPrincipal {
    readonly userId: string;
    readonly tenantId: string;
    readonly roles: readonly string[];
    /** Seconds since epoch; used to reject tokens issued before a credential change. */
    readonly issuedAt: number;
}
