/**
 * Cryptographic primitives used by the auth flows.
 *
 * Refresh and password-reset tokens are opaque random strings hashed before
 * storage — not JWTs. A JWT refresh token cannot be revoked without a
 * denylist, which puts the database read back anyway while making the token
 * larger and self-describing to an attacker.
 */
export interface ISecureRandom {
    /** URL-safe, high-entropy opaque token. */
    opaqueToken(byteLength?: number): string;
    /** Hex SHA-256. Used to store token digests, never passwords. */
    sha256(value: string): string;
    uuid(): string;
}
