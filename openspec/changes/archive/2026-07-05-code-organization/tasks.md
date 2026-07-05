# Tasks — code-organization

## 1. Foundations

- [x] 1.1 Install `server-only` (pnpm)
- [x] 1.2 Create `src/lib/errors.ts` with `ApiError` + `Result` + one `ApiErrorSchema`; update all importers (`db/*`, `domain/*` + tests, `lib/api/**`)
- [x] 1.3 Register `app.onError` in `setup.ts` (ApiError → `toJson()` 500, else rethrow); strip `mapToValue`/`try-catch` from list/get handlers; delete `mapToValue`, `MaybeResultPromise`, `mapError`, `_mapError`, `_jsonContent`; delete `lib/api/helpers.ts`
- [x] 1.4 Move `db/validationschemas.ts` → `src/shared/domain.ts` (git mv) and add `dkimRecordName`/`dkimRecordValue` one-liners; update all importers; UI and `domain/dkim.ts` use the shared templates
- [x] 1.5 Split `src/db/client.ts` (drizzle pool + dev singleton) out of `db/schema.ts`; queries import both; confirm drizzle-kit still reads `schema.ts`

## 2. Boundary enforcement

- [x] 2.1 Add `import "server-only"` to: `db/client.ts`, `db/domains.ts`, `db/users.ts`, `lib/env.ts`, `domain/verification.ts`, `domain/notifications.ts`, `domain/dkim.ts`, `domain/dns.ts`, `domain/crypto.ts`, `lib/auth/*`, `lib/api/setup.ts` and route files
- [x] 2.2 Verify vitest still runs (alias `server-only` to a stub in `vitest.config.ts` if it throws)
- [x] 2.3 Prove the guard: temporarily import `db/client` from a client component, confirm the build error, revert

## 3. Shared wire schemas & type helpers

- [x] 3.1 Create `src/shared/api.ts`: `CreateDomainInputSchema`, `DomainResponseSchema`, `DomainListResponseSchema`, `DeleteDomainResponseSchema`, `CronSweepResponseSchema` built from the shared contract
- [x] 3.2 Routes use the shared schemas in their OpenAPI response definitions; hooks drop their local `DomainResponse`/`DomainListResponse` copies
- [x] 3.3 Create `src/shared/types.ts` with `RequiredBy`; `verification.ts` imports it

## 4. Micro-cleanups & audit sweep

- [x] 4.1 Delete `lib/api/index.ts`; point the one importer (if any) at `setup.ts`
- [x] 4.2 Collapse the ownership-404 duplication in get/verify/delete handlers with a `getOwnedDomain(session, id)` helper
- [x] 4.3 Delete zero-caller code: `getDomainsByStatus`, `resolveNs`/`resolveMx`/`resolveSrv`, `checkTrigger`/`checkOutcome` enums + commented `checks` table, `dkimSelector` env var, all commented-out corpse blocks (schema.ts, db/domains.ts, setup.ts), `result || []` after `.execute()`
- [x] 4.4 Inline `sessionQueryOptions` into `useSession`
- [x] 4.5 Replace `dotenv` with `process.loadEnvFile()` in `vitest.config.ts`; remove the dep
- [x] 4.6 Try removing `pg` + `@types/pg`; verify `drizzle-kit push` still works against `postgres` — keep them if it doesn't

## 5. Verification

- [x] 5.1 Full suite green (45), typecheck clean, `next build` passes
- [x] 5.2 Browser smoke: list page + detail page render and verify button works
- [x] 5.3 Run `drizzle-kit push` to drop the orphaned pg enums; confirm no other schema drift
- [x] 5.4 Commit

## 6. Fallow findings (post-audit follow-up)

- [x] 6.1 Remove unused `@auth/drizzle-adapter`; move `drizzle-kit` to devDependencies
- [x] 6.2 Un-export module-internal symbols (query options, `partialDomainTable`, `resolveDkim`, `wrapDns`, `CheckLogEntrySchema`); keep `decryptPrivateKey` with suppression + rationale
- [x] 6.3 `domainNotFound(c)` helper for the uniform 404 (get/verify/delete)
- [x] 6.4 `.fallowrc.jsonc` ignoring the `postgres` false positive (dynamic import via drizzle); clean leftover enum comment corpses in shared/domain.ts
- [x] 6.5 Health score 57 C → 78 B; declined: splitting `transition` (complexity is the domain, fully tested) and `DomainPage` (page-local composition until it grows again)
