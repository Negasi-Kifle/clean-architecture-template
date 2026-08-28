import { UserEntity } from "./user.entity";
import { CredentialChangeReason, UserRole, UserType } from "../enums";
import { ValidationError } from "../errors";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

function validInput() {
    return {
        tenantId: TENANT_ID,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "  Ada@Example.COM ",
        phoneNumber: "+251 91-234 5678",
        passwordHash: "hashed:secret",
        roles: [UserRole.Member],
    };
}

describe("UserEntity.create", () => {
    it("normalizes email and phone so uniqueness comparisons are stable", () => {
        const user = UserEntity.create(validInput());

        expect(user.email).toBe("ada@example.com");
        expect(user.phoneNumber).toBe("+251912345678");
    });

    it("deduplicates roles", () => {
        const user = UserEntity.create({
            ...validInput(),
            roles: [UserRole.Member, UserRole.Member, UserRole.TenantAdmin],
        });

        expect(user.roles).toEqual([UserRole.Member, UserRole.TenantAdmin]);
    });

    it("reports every invalid field at once instead of stopping at the first", () => {
        expect.assertions(2);
        try {
            UserEntity.create({ ...validInput(), firstName: "A", email: "nope", roles: [] });
        } catch (error) {
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).issues.map((i) => i.field).sort()).toEqual([
                "email",
                "firstName",
                "roles",
            ]);
        }
    });

    it("defaults to an active Employee account that need not change its password", () => {
        const user = UserEntity.create(validInput());

        expect(user.isActive).toBe(true);
        expect(user.userType).toBe(UserType.Employee);
        expect(user.mustChangePassword).toBe(false);
    });
});

describe("UserEntity.rehydrate", () => {
    /**
     * The regression this locks down: hydrating through the creation
     * constructor means a row written under looser rules throws on READ. A
     * tightened validation rule must never make existing data unreadable.
     */
    it("accepts persisted rows that would fail today's creation rules", () => {
        const props = UserEntity.create(validInput()).toPrimitives();

        const legacy = UserEntity.rehydrate({
            ...props,
            id: "22222222-2222-4222-8222-222222222222",
            phoneNumber: "123",
            firstName: "X",
        });

        expect(legacy.phoneNumber).toBe("123");
        expect(legacy.firstName).toBe("X");
    });
});

describe("UserEntity.isTokenStale", () => {
    it("accepts a token stamped with version 0 while credentials have never changed", () => {
        const user = UserEntity.create(validInput());

        expect(user.credentialsVersion).toBe(0);
        expect(user.isTokenStale(0)).toBe(false);
    });

    it("rejects a token stamped before a password change", () => {
        const user = UserEntity.create(validInput());
        const versionBefore = user.credentialsVersion;

        user.changePassword("hashed:new");

        expect(user.isTokenStale(versionBefore)).toBe(true);
    });

    /**
     * The regression this locks down: comparing the token's `iat` against
     * `credentialsChangedAt` cannot express this case, because `iat` has
     * one-second resolution. A `<=` comparison rejects the very token the user
     * receives when they sign in immediately after changing their password -
     * locking them out - and `<` lets a pre-change token survive. Exact version
     * equality has neither window.
     */
    it("accepts a token minted in the same millisecond as the change", () => {
        const user = UserEntity.create(validInput());
        user.changePassword("hashed:new");

        expect(user.isTokenStale(user.credentialsVersion)).toBe(false);
    });

    it("rejects every earlier token after a second change", () => {
        const user = UserEntity.create(validInput());
        user.changePassword("hashed:first");
        const afterFirst = user.credentialsVersion;

        // Force a distinct timestamp; two changes inside one millisecond would
        // otherwise produce the same version.
        jest.useFakeTimers().setSystemTime(new Date(afterFirst + 1000));
        user.changePassword("hashed:second");
        jest.useRealTimers();

        expect(user.isTokenStale(afterFirst)).toBe(true);
        expect(user.isTokenStale(user.credentialsVersion)).toBe(false);
    });

    it("rejects a token after the account is deactivated", () => {
        const user = UserEntity.create(validInput());
        const version = user.credentialsVersion;

        user.deactivate();

        expect(user.isTokenStale(version)).toBe(true);
    });
});

describe("UserEntity.update", () => {
    it("invalidates outstanding tokens when the email changes", () => {
        const user = UserEntity.create(validInput());

        user.update({ email: "new@example.com" });

        expect(user.email).toBe("new@example.com");
        expect(user.credentialsChangedAt).not.toBeNull();
    });

    it("does not invalidate tokens when the email is re-submitted unchanged", () => {
        const user = UserEntity.create(validInput());

        user.update({ email: "ADA@example.com" });

        expect(user.credentialsChangedAt).toBeNull();
    });

    it("deactivating marks credentials changed so live tokens stop working", () => {
        const user = UserEntity.create(validInput());

        user.deactivate();

        expect(user.isActive).toBe(false);
        expect(user.canAuthenticate()).toBe(false);
        expect(user.credentialsChangedAt).not.toBeNull();
    });
});

describe("UserEntity.changePassword", () => {
    it("clears the forced-change flag and records the reason", () => {
        const user = UserEntity.create({ ...validInput(), mustChangePassword: true });

        user.changePassword("hashed:brand-new");

        expect(user.mustChangePassword).toBe(false);
        expect(user.toPrimitives().credentialsChangedFor).toBe(CredentialChangeReason.Password);
    });

    it("rejects an empty hash", () => {
        const user = UserEntity.create(validInput());
        expect(() => user.changePassword("  ")).toThrow(ValidationError);
    });
});
