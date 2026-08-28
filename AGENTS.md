# AGENTS.md

Guidance for coding agents (Codex, Cursor, and others) working in this repository.

Read `README.md` first — it explains the tenancy model and the request flow.
This file covers the rules that are not obvious from reading the code.

---

## Working rules

### 0. When in doubt, stop and ask

Always ask before: architectural decisions, new dependencies, schema changes, or
anything touching auth, tenancy or user data. Proceed and report for renames,
small bug fixes and formatting.

### 1. Respect the dependency rule

- `domain/` imports nothing from outer layers. No Express, no Prisma, no Zod.
- Use cases depend on domain interfaces only.
- Infrastructure implements interfaces defined in the domain — never the reverse.
- Concrete classes are constructed in `composition/` and nowhere else.

If a feature has no obvious home in this structure, ask before inventing one.

### 2. Never weaken tenant isolation

This is the rule that matters most.

- Every tenant-owned model has `tenantId String @db.Uuid` **NOT NULL**, and is
  registered in `TENANT_SCOPED_MODELS` in `prisma.client.ts`.
- Never add a `tenantId`-nullable model. Never special-case a query out of
  scoping.
- `runCrossTenant()` is the only escape hatch. Adding a new call to it is an
  architectural decision — ask first. Today it is used only by login, refresh,
  password reset, platform administration and the seed.
- Anything reachable across tenants belongs on `IIdentityRepository`, so the
  set stays auditable in one file.
- Never disable, weaken or work around `MissingTenantScopeError`. If it fires,
  the calling code is wrong, not the extension.

### 3. Before implementing a feature

Search the codebase for an existing implementation. If it exists fully or
partially, report where and ask whether to extend it. Do not duplicate.

### 4. Scope control

Implement exactly what was asked. Do not refactor, rename or restructure code
outside the task, even if it looks wrong. Flag it in your report instead.

### 5. Dependencies

Do not add a package without approval. Propose it with a justification and say
what it replaces.

### 6. Never do

- Modify `.env` or anything containing secrets.
- Run destructive database commands (`prisma migrate reset`, `db push
--force-reset`, manual `DROP`) without an explicit instruction.
  `npx prisma migrate dev` after an approved schema change is expected.
- Commit, stage or push unless asked.
- Add `console.log`. ESLint blocks it; use the logger from `shared/logger`.
- Return an entity straight from a controller. Map it through a response DTO.

---

## Commands

```bash
npm run dev              # tsx watch
npm run build            # prisma generate && tsc
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run format           # prettier --write
npm test                 # unit + integration (integration skips without TEST_DATABASE_URL)
npm run test:unit        # no database
npm run test:int         # needs TEST_DATABASE_URL
npm run prisma:migrate   # migrate dev
npm run db:seed          # idempotent bootstrap
npm run generate:module  # scaffold a domain across every layer
npm run generate:openapi # regenerate docs/openapi.json from the Zod schemas
```

Single test file: `npx jest src/path/to/file.spec.ts`

After a schema change: `npx prisma migrate dev --name <change>` then
`npm run prisma:generate`.

---

## Patterns to follow

**Entities.** Object parameters, never positional. `create()` validates and is
for new instances; `rehydrate()` does not validate and is for persisted rows.
Mutations are intention-revealing methods (`changePassword`, `deactivate`,
`assignToBranch`), not public field assignment.

**Repositories.** `update(entity: T)` takes a full entity, not `Partial<T>`.
Filters and sort fields are explicit type parameters, never `Partial<Entity>`.
Every list method routes sorting through `buildOrderBy`.

**Use cases.** One class, one `execute()`. Throw domain errors. Take
`AuthenticatedPrincipal` as the first argument when the operation is
authorization-sensitive. Multi-aggregate writes go through `IUnitOfWork`, not
through a new repository method.

**Controllers.** Read from `res.locals` via `getValidated()` — never from
`req.body`, which has not been validated. No try/catch: Express 5 forwards
rejected promises to the error middleware.

**DTOs.** `.strict()` on every write payload. Query booleans go through
`booleanQuery` (a raw `z.boolean()` treats the string `"false"` as `true`).
Sortable fields are a closed allow-list.

**Errors.** Add a class in `domain/errors/`, then one line in `STATUS_BY_ERROR`
in `error-handler.middleware.ts`. Never throw an HTTP status from a use case.

---

## Things that look like bugs but are not

- **`credentialsVersion` in the token, not `iat`.** JWT `iat` has one-second
  resolution, which leaves no correct threshold — see `UserEntity.isTokenStale`.
- **`findByRefreshTokenHash` returns revoked sessions.** That is the reuse
  signal. Filtering them out would make a stolen token indistinguishable from a
  typo.
- **Login compares against a dummy hash when the user does not exist.** Timing
  equalisation; removing it turns the endpoint into a user-enumeration oracle.
- **`forgot-password` always returns success.** Any other behaviour reveals
  which addresses have accounts.
- **Another tenant's record returns 404, not 403.** A 403 would confirm the id
  exists somewhere.
- **`runWithTenant` awaits inside the context.** A Prisma query is a lazy
  thenable; returning it unawaited executes it after the context has closed.
- **Employee create re-reads through `findDetailById`.** So the create response
  has the same shape as a GET.

---

## Testing expectations

- A new use case gets unit tests against the fakes in `src/testing/fakes.ts`.
- A new tenant-owned model gets a case in `tenant-isolation.int.spec.ts`.
- A new endpoint gets a case in `api.int.spec.ts`.
- Tests assert behaviour and name the risk. `it("rejects a token stamped before
a password change")` — not `it("works")`.
