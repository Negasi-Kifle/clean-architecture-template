/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-memory doubles for the ports the use cases depend on.
 *
 * These exist so that use-case tests — which is where the business rules live
 * — run in milliseconds with no database, no container and no network. If a
 * rule can only be tested against a real Postgres, it is a sign the rule
 * leaked into the repository.
 *
 * `any` is enabled here because the fakes deliberately take shortcuts that
 * production code may not; nothing in this folder is compiled into `dist`.
 */
import { randomUUID, createHash } from "node:crypto";
import {
    PasswordResetTokenEntity,
    SessionEntity,
    TenantEntity,
    UserEntity,
    type SessionRevocationReasonValue,
} from "../domain/entities";
import type { UserRole } from "../domain/enums";
import type {
    IIdentityRepository,
    IPasswordResetTokenRepository,
    ISessionRepository,
    ITenantRepository,
    IUnitOfWork,
    IUserRepository,
    TransactionalRepositories,
} from "../domain/repositories";
import type {
    AccessTokenClaims,
    IPasswordHasher,
    ISecureRandom,
    ITokenService,
    VerifiedAccessToken,
} from "../domain/services";

/** Reversible "hashing". Never anywhere near production — see the file header. */
export class FakePasswordHasher implements IPasswordHasher {
    async hash(plaintext: string): Promise<string> {
        return `hashed:${plaintext}`;
    }
    async compare(plaintext: string, hash: string): Promise<boolean> {
        return hash === `hashed:${plaintext}`;
    }
}

export class FakeSecureRandom implements ISecureRandom {
    private counter = 0;

    opaqueToken(): string {
        this.counter += 1;
        return `token-${this.counter}`;
    }
    sha256(value: string): string {
        return createHash("sha256").update(value).digest("hex");
    }
    uuid(): string {
        return randomUUID();
    }
}

export class FakeTokenService implements ITokenService {
    public signed: AccessTokenClaims[] = [];

    async signAccessToken(claims: AccessTokenClaims): Promise<string> {
        this.signed.push(claims);
        return `access-${claims.sub}-${this.signed.length}`;
    }

    async verifyAccessToken(): Promise<VerifiedAccessToken> {
        throw new Error("FakeTokenService.verifyAccessToken is not implemented");
    }
}

function withId<T extends { toPrimitives(): { id: string } }>(entity: T, id: string): T {
    (entity as any).props.id = id;
    return entity;
}

export class FakeUserStore {
    readonly users = new Map<string, UserEntity>();

    add(user: UserEntity, id = randomUUID()): UserEntity {
        withId(user, id);
        this.users.set(id, user);
        return user;
    }
}

export class FakeIdentityRepository implements IIdentityRepository {
    constructor(private readonly store: FakeUserStore) {}

    async findByEmailOrPhone(identifier: string): Promise<UserEntity | null> {
        const needle = identifier.trim().toLowerCase();
        for (const user of this.store.users.values()) {
            if (user.email === needle || user.phoneNumber === needle) return user;
        }
        return null;
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.findByEmailOrPhone(email);
    }

    async findById(id: string): Promise<UserEntity | null> {
        return this.store.users.get(id) ?? null;
    }
}

export class FakeUserRepository implements Partial<IUserRepository> {
    constructor(private readonly store: FakeUserStore) {}

    async findById(id: string): Promise<UserEntity | null> {
        return this.store.users.get(id) ?? null;
    }
    async update(user: UserEntity): Promise<UserEntity> {
        this.store.users.set(user.id, user);
        return user;
    }
    async countByRole(role: UserRole): Promise<number> {
        return [...this.store.users.values()].filter((u) => u.hasRole(role)).length;
    }
}

export class FakeTenantRepository implements Partial<ITenantRepository> {
    readonly tenants = new Map<string, TenantEntity>();

    add(tenant: TenantEntity, id = randomUUID()): TenantEntity {
        withId(tenant, id);
        this.tenants.set(id, tenant);
        return tenant;
    }

    async findById(id: string): Promise<TenantEntity | null> {
        return this.tenants.get(id) ?? null;
    }
}

export class FakeSessionRepository implements ISessionRepository {
    readonly sessions: SessionEntity[] = [];

    async create(session: SessionEntity): Promise<SessionEntity> {
        withId(session, randomUUID());
        this.sessions.push(session);
        return session;
    }

    async findByRefreshTokenHash(tokenHash: string): Promise<SessionEntity | null> {
        return this.sessions.find((s) => s.toPrimitives().refreshTokenHash === tokenHash) ?? null;
    }

    async findActiveByUserId(userId: string): Promise<SessionEntity[]> {
        return this.sessions.filter((s) => s.userId === userId && s.isUsable);
    }

    async revoke(sessionId: string, reason: SessionRevocationReasonValue): Promise<void> {
        this.sessions.find((s) => s.id === sessionId)?.revoke(reason);
    }

    async revokeFamily(familyId: string, reason: SessionRevocationReasonValue): Promise<number> {
        const targets = this.sessions.filter((s) => s.familyId === familyId && !s.isRevoked);
        targets.forEach((s) => s.revoke(reason));
        return targets.length;
    }

    async revokeAllForUser(userId: string, reason: SessionRevocationReasonValue): Promise<number> {
        const targets = this.sessions.filter((s) => s.userId === userId && !s.isRevoked);
        targets.forEach((s) => s.revoke(reason));
        return targets.length;
    }

    async deleteExpiredBefore(): Promise<number> {
        return 0;
    }
}

export class FakePasswordResetTokenRepository implements IPasswordResetTokenRepository {
    readonly tokens: PasswordResetTokenEntity[] = [];

    async create(token: PasswordResetTokenEntity): Promise<PasswordResetTokenEntity> {
        withId(token, randomUUID());
        this.tokens.push(token);
        return token;
    }
    async findByTokenHash(tokenHash: string): Promise<PasswordResetTokenEntity | null> {
        return this.tokens.find((t) => t.toPrimitives().tokenHash === tokenHash) ?? null;
    }
    async markUsed(id: string): Promise<void> {
        this.tokens.find((t) => t.id === id)?.markUsed();
    }
    async invalidateAllForUser(userId: string): Promise<number> {
        const targets = this.tokens.filter((t) => t.userId === userId && t.usedAt === null);
        targets.forEach((t) => t.markUsed());
        return targets.length;
    }
}

/**
 * Runs the callback immediately with the supplied repositories.
 *
 * No rollback: these tests assert behaviour, not atomicity. Atomicity is the
 * database's job and is covered by the integration tests.
 */
export class FakeUnitOfWork implements IUnitOfWork {
    constructor(private readonly repositories: Partial<TransactionalRepositories>) {}

    async run<T>(work: (repositories: TransactionalRepositories) => Promise<T>): Promise<T> {
        return work(this.repositories as TransactionalRepositories);
    }
}
