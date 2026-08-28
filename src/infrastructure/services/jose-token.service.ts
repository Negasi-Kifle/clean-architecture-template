// jose v5 rather than v6: v6 is ESM-only, and this template compiles to
// CommonJS so that Jest can require it without an ESM transform. Move to v6
// when the project moves to ESM (see README, "Why CommonJS").
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";
import { UnauthenticatedError } from "../../domain/errors";
import { UserRole } from "../../domain/enums";
import type { AccessTokenClaims, ITokenService, VerifiedAccessToken } from "../../domain/services";

export interface JoseTokenServiceOptions {
    secret: string;
    issuer: string;
    audience: string;
    defaultTtlSeconds: number;
}

const KNOWN_ROLES = new Set<string>(Object.values(UserRole));

/**
 * HS256 access tokens via `jose`.
 *
 * `issuer` and `audience` are set AND verified. Without them, a token minted
 * by any other service that happens to share the secret — a staging
 * environment, an internal tool — is accepted here.
 */
export class JoseTokenService implements ITokenService {
    private readonly key: Uint8Array;

    constructor(private readonly options: JoseTokenServiceOptions) {
        this.key = new TextEncoder().encode(options.secret);
    }

    async signAccessToken(claims: AccessTokenClaims, ttlSeconds?: number): Promise<string> {
        const ttl = ttlSeconds ?? this.options.defaultTtlSeconds;

        return new SignJWT({
            tenantId: claims.tenantId,
            roles: claims.roles,
            credentialsVersion: claims.credentialsVersion,
        })
            .setProtectedHeader({ alg: "HS256", typ: "JWT" })
            .setSubject(claims.sub)
            .setIssuer(this.options.issuer)
            .setAudience(this.options.audience)
            .setIssuedAt()
            .setExpirationTime(new Date(Date.now() + ttl * 1000))
            .sign(this.key);
    }

    async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
        try {
            const { payload } = await jwtVerify(token, this.key, {
                algorithms: ["HS256"],
                issuer: this.options.issuer,
                audience: this.options.audience,
            });

            const sub = payload.sub;
            const tenantId = payload.tenantId;

            if (typeof sub !== "string" || sub.length === 0) {
                throw new UnauthenticatedError("Malformed token");
            }
            if (typeof tenantId !== "string" || tenantId.length === 0) {
                throw new UnauthenticatedError("Malformed token");
            }
            if (typeof payload.iat !== "number" || typeof payload.exp !== "number") {
                throw new UnauthenticatedError("Malformed token");
            }
            if (typeof payload.credentialsVersion !== "number") {
                throw new UnauthenticatedError("Malformed token");
            }

            return {
                sub,
                tenantId,
                roles: parseRoles(payload.roles),
                credentialsVersion: payload.credentialsVersion,
                issuedAt: payload.iat,
                expiresAt: payload.exp,
            };
        } catch (error) {
            if (error instanceof UnauthenticatedError) throw error;

            // Every failure mode collapses to the same message. Telling a
            // caller whether a token expired, was signed with the wrong key or
            // was addressed to another audience hands them a debugging tool
            // for forging one.
            if (
                error instanceof joseErrors.JWTExpired ||
                error instanceof joseErrors.JWTClaimValidationFailed ||
                error instanceof joseErrors.JWSSignatureVerificationFailed ||
                error instanceof joseErrors.JWSInvalid
            ) {
                throw new UnauthenticatedError();
            }
            throw new UnauthenticatedError();
        }
    }
}

/**
 * Rejects tokens carrying a role this build does not know about.
 *
 * A role removed from the enum but still present in an old token must not be
 * silently ignored — it would leave the user authenticated with fewer rights
 * than the token claims, which is confusing, or more, which is a hole.
 */
function parseRoles(raw: unknown): UserRole[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new UnauthenticatedError("Malformed token");
    }
    const roles: UserRole[] = [];
    for (const item of raw) {
        if (typeof item !== "string" || !KNOWN_ROLES.has(item)) {
            throw new UnauthenticatedError("Malformed token");
        }
        roles.push(item as UserRole);
    }
    return roles;
}
