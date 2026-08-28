# Clean Architecture API Template

TypeScript · Express 5 · Prisma 7 · PostgreSQL

A back-end template you clone for a new project and start building features in the
same afternoon. Multi-tenant capable, single-tenant ready, with the same code
either way.

---

## Quick start

```bash
git clone <this-template> my-api && cd my-api
rm -rf .git && git init

cp .env.example .env          # then set JWT_SECRET
npm install
docker compose up -d postgres # or point DATABASE_URL at your own

npm run prisma:migrate        # applies the initial migration
npm run db:seed               # creates the tenant(s) + bootstrap admin
npm run dev
```

`GET http://localhost:3000/health` should answer `{"status":"ok"}`.

Sign in with the `BOOTSTRAP_ADMIN_*` credentials from `.env`. That account is
created with `mustChangePassword`, so every endpoint except
`POST /auth/change-password` returns `403 PASSWORD_CHANGE_REQUIRED` until you
change it. That is deliberate: a seeded password lives in an env file and
probably in your shell history.

---

## What you get

|                |                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Auth**       | Login, rotating refresh tokens with reuse detection, logout, logout-all, password reset, forced password change, session list |
| **CRUD**       | Users, employees, branches, tenants — with pagination, search, filters and validated sorting                                  |
| **Tenancy**    | `tenantId` enforced at the driver level; a repository that forgets it cannot leak                                             |
| **Validation** | Zod on body, query _and_ route params; field-level errors                                                                     |
| **Ops**        | Docker Compose, structured logs with request IDs, rate limiting, graceful shutdown, health check, CI                          |
| **Tests**      | 104 tests — unit, plus integration against a real Postgres                                                                    |
| **Tooling**    | `npm run generate:module` scaffolds a domain across every layer; OpenAPI generated from the Zod schemas                       |

---

## Tenancy — read this before anything else

**`tenantId` is `NOT NULL` on every tenant-owned table, in both modes.**

A single-tenant deployment has exactly one tenant row, seeded at bootstrap, and
everything points at it. Nothing in the domain, application or repository layer
branches on the mode. Only two things differ:

|                         | `TENANCY_MODE=single` | `TENANCY_MODE=multi`         |
| ----------------------- | --------------------- | ---------------------------- |
| Tenants in the database | one, seeded           | many, created via `/tenants` |
| `/tenants` routes       | not mounted           | mounted, PlatformAdmin only  |

That is the whole difference. It is what makes single → multi a data migration
rather than a rewrite, and it is why there is no `if (multiTenant)` scattered
through the codebase.

### How scoping is enforced

Not by discipline. A Prisma client extension (`src/infrastructure/prisma/prisma.client.ts`)
injects `tenantId` into every query against a tenant-owned model, and **throws**
when no tenant scope is present:

```ts
// A repository that forgets its where-clause:
await prisma.user.findMany({});
// → MissingTenantScopeError, not "every tenant's users"
```

The tenant comes from an `AsyncLocalStorage` context opened by the auth
middleware, sourced from the **signed JWT** — never from a header, subdomain or
body field, so a client cannot switch tenants by editing a request.

Three narrow paths legitimately cross tenants, and each is explicit:

```ts
runCrossTenant(async () => identityRepository.findByEmailOrPhone(email));
```

Login, refresh and password reset resolve a user _before_ any tenant is known —
the tenant is an output of the lookup, not an input. Platform administration and
the seed script are the others. `IIdentityRepository` exists so that the
question "what in this codebase can read across tenants?" has a one-file answer.

Adding a tenant-owned model? Add `tenantId String @db.Uuid` plus the Tenant
relation, then register the model in `TENANT_SCOPED_MODELS`. A guard test reads
the schema and fails if you forget.

---

## Feature flags

| Variable           | Effect                                                                        |
| ------------------ | ----------------------------------------------------------------------------- |
| `TENANCY_MODE`     | `single` \| `multi` — see above                                               |
| `BRANCHES_ENABLED` | `false` leaves `branchId` nullable and unused, and does not mount `/branches` |

A disabled feature has **no HTTP surface** — it is not mounted, not
authorized, not fuzzable, and returns an honest 404 rather than a confusing 403. The schema is identical either way, so turning branches on later needs no
migration.

---

## Architecture

```
src/
├── domain/          Entities, enums, errors, repository interfaces, service ports
├── application/     Use cases — one class per operation, pure business logic
├── infrastructure/  Prisma repositories, adapters (bcrypt, jose, nodemailer)
├── presentation/    Express routes, controllers, Zod DTOs, middleware
├── composition/     Dependency injection — the only place concrete classes exist
└── shared/          Logger, request context, HTTP status, common types
```

**The dependency rule points inward.** `domain` imports nothing from the outer
layers — no Express, no Prisma, no Zod. That is what lets a use case be tested
with a hand-written fake in milliseconds, and what makes bcrypt → argon2 or
Prisma → anything else a change confined to `infrastructure/`.

### Request flow

```
Router
  → requestContext       opens the async-local store (request id)
  → authenticate         verifies JWT, loads the user, opens the tenant scope
  → enforcePasswordChange
  → authorize(...roles)  route-level role check
  → validateBody/Query/Params → res.locals
  → Controller           reads res.locals, calls a use case, maps to a response DTO
      → Use case         business rules; throws DOMAIN errors, never HTTP errors
          → Repository   tenant scope applied by the Prisma extension
  → errorHandler         maps domain errors to status codes (registered last)
```

Route-level `authorize()` answers _"may this role reach this endpoint"_.
Decisions that need the record — _"may this manager edit **this** user"_ — live
in `src/application/authorization.ts`, next to the operation they guard.

### Multi-aggregate writes

Through the unit of work, in the application layer:

```ts
await this.unitOfWork.run(async (repos) => {
    const user = await repos.users.create(...);
    const employee = await repos.employees.create(...);
    return { user, employee };
});
```

Not as a bespoke `createUserAndEmployee` method bolted onto a repository. That
approach works for the first such operation and stops composing at the second,
because the method has to live on one of the two repositories and the choice is
arbitrary.

---

## Auth model

- **Access token** — JWT/HS256, 15 minutes, carries `sub`, `tenantId`, `roles`
  and `credentialsVersion`.
- **Refresh token** — opaque 256-bit random string, SHA-256 hashed in a
  `Session` row, 7 days. One row per login, so multi-device works and a single
  session can be revoked.
- **Rotation with reuse detection** — every refresh mints a new token and
  revokes the old one. Presenting an already-rotated token means two parties
  hold tokens from the same login, so the entire family is revoked and both must
  sign in again.
- **`credentialsVersion`** — a snapshot of `credentialsChangedAt` in epoch ms,
  compared for exact equality on every request. Changing a password or email
  invalidates every outstanding access token instantly. (Comparing the token's
  `iat` instead is broken by JWT's one-second resolution: `<=` locks out the
  token the user just received, `<` lets a pre-change token survive.)
- **The auth middleware reads the database on every request.** A signature
  proves who minted a token, not that the account still exists or is still
  active. If that ever becomes a bottleneck, cache the user by id with a TTL
  shorter than the access token — do not remove the check.

### Roles

`PlatformAdmin` → `TenantAdmin` → `BranchManager` → `Member`

Nobody can grant a role they do not hold themselves. Without that rule any
tenant admin can mint a `PlatformAdmin` and escalate out of their own tenant —
and a route-level guard will not catch it, because the request _is_ from an
admin; it is the payload that is dangerous.

---

## Adding a domain

```bash
npm run generate:module      # prompts for a singular name, e.g. "product"
```

Scaffolds the entity, repository interface, use cases, Prisma repository,
mapper, where-clause builder, DTOs, response mapper, controller, router and
composition module — then prints the four steps it deliberately leaves to you
(schema model, migration, index exports, wiring).

The generator is not about typing speed. It is about a new domain landing with
the same tenant scoping, validation and error handling as every other one, so
the architecture stays uniform under deadline pressure — which is exactly when
it usually stops being uniform.

---

## Testing

```bash
npm run test:unit    # no database needed
npm run test:int     # needs TEST_DATABASE_URL
npm test             # both; integration tests skip when TEST_DATABASE_URL is unset
```

```bash
docker compose up -d postgres-test
export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5433/app_test?schema=public"
DATABASE_URL=$TEST_DATABASE_URL npm run prisma:deploy
npm run test:int
```

Use-case tests run against the in-memory doubles in `src/testing/fakes.ts` — if
a business rule can only be tested against a real Postgres, that rule has leaked
into the repository.

`src/infrastructure/prisma/tenant-isolation.int.spec.ts` is the most important
file in the suite. Everything else is a bug; a failure there is a data breach.

---

## Conventions

- **Entities take object parameters**, never positional ones. A 13-argument
  positional constructor means inserting one parameter silently shifts every
  call site with no type error.
- **`create()` validates, `rehydrate()` does not.** Hydrating a persisted row
  through the creation constructor means a row written under looser rules throws
  on _read_ — tightening a rule must never make existing data unreadable.
- **DTOs are `.strict()`.** Unknown fields are a 400, not a silent drop.
- **Repositories return entities**, never Prisma rows.
- **Use cases throw domain errors**, never HTTP errors.
- **Response DTOs are built field by field**, never by spreading an entity — a
  spread leaks whatever sensitive prop gets added later.
- **Soft delete by default.** A hard delete breaks every historical row that
  references the record and cannot be undone after a mistaken click.
- **No `console.log`.** ESLint blocks it; use the structured logger.

---

## Environment

Every variable is validated by a Zod schema at boot (`src/config.ts`), so a
missing or malformed value fails the process immediately with a precise message
instead of surfacing as `undefined` three layers deep at 2am.

Production additionally requires `JWT_SECRET` (32+ chars), a real `CORS_ORIGINS`
(not `*`) and `CLIENT_URL`. See `.env.example` for the full list.

---

## Notes

**Why CommonJS.** `jose` v6 is ESM-only and Jest cannot `require()` it on
Node < 24.9 without an extra transform. The template pins `jose` v5 (CJS) and
compiles to CommonJS. Move both together when you move the project to ESM.

**Prisma client output.** Generated to
`src/infrastructure/prisma/generated/client`, not `node_modules`. Import from
there, not from `@prisma/client`. It is gitignored — run `npm run prisma:generate`
after a clone.

**The initial migration is hand-written** rather than produced by
`prisma migrate dev`, and is verified by the integration tests, which run every
query in the codebase against a database built from it. If you would rather
start from a Prisma-generated one, delete
`src/infrastructure/prisma/migrations/` and run `npx prisma migrate dev --name init`
against an empty database.
