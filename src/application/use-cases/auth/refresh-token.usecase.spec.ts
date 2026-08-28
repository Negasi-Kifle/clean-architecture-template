import { RefreshTokenUseCase } from "./refresh-token.usecase";
import { SessionEntity, UserEntity } from "../../../domain/entities";
import { UserRole } from "../../../domain/enums";
import {
    AccountInactiveError,
    InvalidRefreshTokenError,
    RefreshTokenReuseDetectedError,
} from "../../../domain/errors";
import {
    FakeIdentityRepository,
    FakeSecureRandom,
    FakeSessionRepository,
    FakeTokenService,
    FakeUnitOfWork,
    FakeUserStore,
} from "../../../testing/fakes";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const FAMILY_ID = "33333333-3333-4333-8333-333333333333";

function setup() {
    const store = new FakeUserStore();
    const sessionRepository = new FakeSessionRepository();
    const secureRandom = new FakeSecureRandom();

    const user = store.add(
        UserEntity.create({
            tenantId: TENANT_ID,
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
            phoneNumber: "0912345678",
            passwordHash: "hashed:pw",
            roles: [UserRole.Member],
        }),
    );

    const useCase = new RefreshTokenUseCase({
        sessionRepository,
        identityRepository: new FakeIdentityRepository(store),
        tokenService: new FakeTokenService(),
        secureRandom,
        unitOfWork: new FakeUnitOfWork({ sessions: sessionRepository }),
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 604800,
    });

    async function issue(plaintext: string, familyId = FAMILY_ID): Promise<string> {
        await sessionRepository.create(
            SessionEntity.create({
                tenantId: TENANT_ID,
                userId: user.id,
                refreshTokenHash: secureRandom.sha256(plaintext),
                familyId,
                expiresAt: new Date(Date.now() + 60_000),
            }),
        );
        return plaintext;
    }

    return { useCase, sessionRepository, user, issue };
}

describe("RefreshTokenUseCase", () => {
    it("returns a new access token and a NEW refresh token", async () => {
        const { useCase, issue } = setup();
        const original = await issue("original-token");

        const result = await useCase.execute({ refreshToken: original });

        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).not.toBe(original);
    });

    it("revokes the presented token, so it cannot be used twice", async () => {
        const { useCase, sessionRepository, issue } = setup();
        const original = await issue("original-token");

        await useCase.execute({ refreshToken: original });

        expect(sessionRepository.sessions[0]!.isRevoked).toBe(true);
        expect(sessionRepository.sessions[1]!.isUsable).toBe(true);
    });

    it("keeps the rotated token in the same family", async () => {
        const { useCase, sessionRepository, issue } = setup();

        await useCase.execute({ refreshToken: await issue("original-token") });

        expect(sessionRepository.sessions[1]!.familyId).toBe(FAMILY_ID);
    });

    /**
     * The core security property. Presenting an already-rotated token means
     * two parties hold tokens from the same login; there is no way to tell
     * which is legitimate, so the whole family dies and both must re-auth.
     */
    it("revokes the entire family when an already-rotated token is replayed", async () => {
        const { useCase, sessionRepository, issue } = setup();
        const original = await issue("original-token");

        const rotated = await useCase.execute({ refreshToken: original });

        await expect(useCase.execute({ refreshToken: original })).rejects.toBeInstanceOf(
            RefreshTokenReuseDetectedError,
        );

        // Including the token the honest client is currently holding.
        expect(sessionRepository.sessions.every((session) => session.isRevoked)).toBe(true);
        await expect(useCase.execute({ refreshToken: rotated.refreshToken })).rejects.toThrow();
    });

    it("does not touch other logins when one family is burned", async () => {
        const { useCase, sessionRepository, issue } = setup();
        const otherFamily = "44444444-4444-4444-8444-444444444444";
        const first = await issue("first-token");
        await issue("second-device-token", otherFamily);

        await useCase.execute({ refreshToken: first });
        await expect(useCase.execute({ refreshToken: first })).rejects.toThrow();

        const otherDevice = sessionRepository.sessions.find((s) => s.familyId === otherFamily);
        expect(otherDevice!.isRevoked).toBe(false);
    });

    it("rejects a token that was never issued", async () => {
        const { useCase } = setup();

        await expect(useCase.execute({ refreshToken: "made-up" })).rejects.toBeInstanceOf(
            InvalidRefreshTokenError,
        );
    });

    it("rejects an expired token", async () => {
        const { useCase, sessionRepository, issue } = setup();
        const token = await issue("about-to-expire");

        // Reach past the entity's guard against creating an already-expired
        // session; only the passage of time can produce this state naturally.
        const props = sessionRepository.sessions[0]!.toPrimitives();
        sessionRepository.sessions[0] = SessionEntity.rehydrate({
            ...props,
            expiresAt: new Date(Date.now() - 1000),
        });

        await expect(useCase.execute({ refreshToken: token })).rejects.toBeInstanceOf(
            InvalidRefreshTokenError,
        );
    });

    it("refuses to refresh for a deactivated user and kills the family", async () => {
        const { useCase, sessionRepository, user, issue } = setup();
        const token = await issue("valid-token");

        user.deactivate();

        await expect(useCase.execute({ refreshToken: token })).rejects.toBeInstanceOf(
            AccountInactiveError,
        );
        expect(sessionRepository.sessions[0]!.isRevoked).toBe(true);
    });
});
