import { LoginUseCase } from "./login.usecase";
import { TenantEntity, UserEntity } from "../../../domain/entities";
import { UserRole } from "../../../domain/enums";
import { AccountInactiveError, InvalidCredentialsError } from "../../../domain/errors";
import {
    FakeIdentityRepository,
    FakePasswordHasher,
    FakeSecureRandom,
    FakeSessionRepository,
    FakeTenantRepository,
    FakeTokenService,
    FakeUserRepository,
    FakeUserStore,
} from "../../../testing/fakes";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

function setup(options: { active?: boolean; tenantActive?: boolean } = {}) {
    const store = new FakeUserStore();
    const tenantRepository = new FakeTenantRepository();
    const sessionRepository = new FakeSessionRepository();
    const tokenService = new FakeTokenService();

    tenantRepository.add(
        TenantEntity.create({
            slug: "acme",
            name: "Acme",
            isActive: options.tenantActive ?? true,
        }),
        TENANT_ID,
    );

    const user = store.add(
        UserEntity.create({
            tenantId: TENANT_ID,
            firstName: "Ada",
            lastName: "Lovelace",
            email: "ada@example.com",
            phoneNumber: "0912345678",
            passwordHash: "hashed:correct-horse",
            roles: [UserRole.Member],
            isActive: options.active ?? true,
        }),
    );

    const useCase = new LoginUseCase({
        identityRepository: new FakeIdentityRepository(store),
        tenantRepository: tenantRepository as never,
        sessionRepository,
        userRepository: new FakeUserRepository(store) as never,
        passwordHasher: new FakePasswordHasher(),
        tokenService,
        secureRandom: new FakeSecureRandom(),
        accessTokenTtlSeconds: 900,
        refreshTokenTtlSeconds: 604800,
    });

    return { useCase, user, sessionRepository, tokenService };
}

describe("LoginUseCase", () => {
    it("issues an access token and a refresh token on valid credentials", async () => {
        const { useCase, sessionRepository } = setup();

        const result = await useCase.execute({
            identifier: "ada@example.com",
            password: "correct-horse",
        });

        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();
        expect(result.expiresInSeconds).toBe(900);
        expect(sessionRepository.sessions).toHaveLength(1);
    });

    it("accepts a phone number as the identifier", async () => {
        const { useCase } = setup();

        await expect(
            useCase.execute({ identifier: "0912345678", password: "correct-horse" }),
        ).resolves.toMatchObject({ accessToken: expect.any(String) });
    });

    it("stores only a hash of the refresh token", async () => {
        const { useCase, sessionRepository } = setup();

        const result = await useCase.execute({
            identifier: "ada@example.com",
            password: "correct-horse",
        });

        const stored = sessionRepository.sessions[0]!.toPrimitives().refreshTokenHash;
        expect(stored).not.toBe(result.refreshToken);
        expect(stored).toHaveLength(64);
    });

    it("puts the tenant into the token claims, not into anything client-supplied", async () => {
        const { useCase, tokenService } = setup();

        await useCase.execute({ identifier: "ada@example.com", password: "correct-horse" });

        expect(tokenService.signed[0]).toMatchObject({ tenantId: TENANT_ID });
    });

    it("rejects a wrong password", async () => {
        const { useCase } = setup();

        await expect(
            useCase.execute({ identifier: "ada@example.com", password: "wrong" }),
        ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    /**
     * An unknown account and a wrong password must be indistinguishable, or
     * the endpoint becomes a way to enumerate which addresses have accounts.
     */
    it("gives an unknown account the same error as a wrong password", async () => {
        const { useCase } = setup();

        const unknown = useCase.execute({ identifier: "nobody@example.com", password: "x" });
        const wrongPassword = useCase.execute({
            identifier: "ada@example.com",
            password: "wrong",
        });

        await expect(unknown).rejects.toBeInstanceOf(InvalidCredentialsError);
        await expect(wrongPassword).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("creates no session for a failed attempt", async () => {
        const { useCase, sessionRepository } = setup();

        await expect(
            useCase.execute({ identifier: "ada@example.com", password: "wrong" }),
        ).rejects.toThrow();

        expect(sessionRepository.sessions).toHaveLength(0);
    });

    /**
     * Ordering matters: the account-state error is only reachable once the
     * password has been verified. Reporting "deactivated" to someone who
     * supplied the wrong password would confirm the account exists.
     */
    it("reports a deactivated account only after the password checks out", async () => {
        const { useCase } = setup({ active: false });

        await expect(
            useCase.execute({ identifier: "ada@example.com", password: "correct-horse" }),
        ).rejects.toBeInstanceOf(AccountInactiveError);

        await expect(
            useCase.execute({ identifier: "ada@example.com", password: "wrong" }),
        ).rejects.toBeInstanceOf(InvalidCredentialsError);
    });

    it("refuses to sign in to a deactivated workspace", async () => {
        const { useCase } = setup({ tenantActive: false });

        await expect(
            useCase.execute({ identifier: "ada@example.com", password: "correct-horse" }),
        ).rejects.toBeInstanceOf(AccountInactiveError);
    });

    it("gives each login its own session family so one revocation is not global", async () => {
        const { useCase, sessionRepository } = setup();

        await useCase.execute({ identifier: "ada@example.com", password: "correct-horse" });
        await useCase.execute({ identifier: "ada@example.com", password: "correct-horse" });

        const [first, second] = sessionRepository.sessions;
        expect(sessionRepository.sessions).toHaveLength(2);
        expect(first!.familyId).not.toBe(second!.familyId);
    });
});
