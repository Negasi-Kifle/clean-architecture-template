import { SessionEntity, SessionRevocationReason } from "./session.entity";
import { ValidationError } from "../errors";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const FAMILY_ID = "33333333-3333-4333-8333-333333333333";

function create(overrides: Partial<Parameters<typeof SessionEntity.create>[0]> = {}) {
    return SessionEntity.create({
        tenantId: TENANT_ID,
        userId: USER_ID,
        refreshTokenHash: "a".repeat(64),
        familyId: FAMILY_ID,
        expiresAt: new Date(Date.now() + 60_000),
        ...overrides,
    });
}

describe("SessionEntity", () => {
    it("refuses to be created already expired", () => {
        expect(() => create({ expiresAt: new Date(Date.now() - 1000) })).toThrow(ValidationError);
    });

    it("is usable while neither revoked nor expired", () => {
        expect(create().isUsable).toBe(true);
    });

    it("stops being usable once revoked", () => {
        const session = create();
        session.revoke(SessionRevocationReason.ROTATED);

        expect(session.isUsable).toBe(false);
        expect(session.revokedReason).toBe(SessionRevocationReason.ROTATED);
    });

    /**
     * Revocation must be write-once. If a later revoke overwrote the reason,
     * a routine "rotated" would erase the "reuse_detected" that a security
     * investigation depends on.
     */
    it("keeps the first revocation reason", () => {
        const session = create();
        session.revoke(SessionRevocationReason.REUSE_DETECTED);
        session.revoke(SessionRevocationReason.LOGOUT);

        expect(session.revokedReason).toBe(SessionRevocationReason.REUSE_DETECTED);
    });

    it("truncates an oversized user agent rather than rejecting the login", () => {
        const session = create({ userAgent: "x".repeat(2000) });
        expect(session.userAgent).toHaveLength(512);
    });
});
