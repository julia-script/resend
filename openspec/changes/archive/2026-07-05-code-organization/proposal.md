# Code Organization

## Why

The module layout has three structural smells that make the codebase harder to read than it deserves: the server/client boundary is enforced only by a comment (and has already caused one fs-in-browser crash), `ApiError` lives under `lib/api/` while being the whole app's error type (creating a `db → lib/api → db` layering loop), and two files carry misleading names/homes (`db/validationschemas.ts` is really the shared client/server domain contract; `db/schema.ts` mixes table definitions with the live connection pool). For a take-home, the file tree is part of the deliverable — it should read like the architecture.

## What Changes

- **Mechanical server/client boundary**: add the `server-only` package guard to every server-only module (`db/schema`, `db/*` queries, `lib/env`, `domain/verification`, `domain/notifications`, `domain/dkim`, `domain/dns`, `domain/crypto`, `lib/auth/*`, `lib/api` server files). Accidental client imports become build errors instead of runtime crashes.
- **Extract `lib/errors.ts`**: `ApiError` + `Result` move out of `lib/api/helpers.ts`; all importers update. `helpers.ts` then holds only dead code and is deleted (`mapError`, `_mapError` were already unused; `mapToValue` moves with `ApiError` as a static).
- **Re-home the shared contract**: `db/validationschemas.ts` → `src/shared/domain.ts` (enum value arrays, `PartialDomainSchema`, `CheckLogEntrySchema`, inferred types). The client-safety comment becomes the module's identity instead of a warning.
- **Split `db/client.ts` from `db/schema.ts`**: the drizzle pool + globalThis singleton move to `client.ts`; `schema.ts` keeps only table/enum definitions (which is all drizzle-kit needs).
- **Single-source wire schemas in `src/shared/api.ts`**: the `{ data: … }` response envelopes and request bodies are currently declared 7 times across route files and hooks. They move to one module built on the shared contract; server routes (OpenAPI response schemas) and client hooks (up-fetch validation) import the same objects. The duplicated `ApiErrorSchema` (defined twice in `helpers.ts`) collapses into one export from `lib/errors.ts`.
- **Global type helpers in `src/shared/types.ts`**: generic utilities (`RequiredBy`, and `Result` if it reads better there than in `errors.ts`) get one home instead of being declared inside whichever module needed them first.
- **Hono-native error handling**: one `app.onError` maps thrown `ApiError`s to their JSON shape; the per-route `mapToValue`/`try-catch` plumbing (and `MaybeResultPromise`) is deleted. Unhandled `ApiError`s currently leak as text 500s from routes that never adopted the wrapper — this fixes that inconsistency as a side effect.
- **DKIM record templates single-sourced**: `recordName`/`recordValue` move to the shared contract module; the UI stops inlining `${selector}._domainkey.${name}` / `v=DKIM1; …` by hand (4 copies today).
- **Micro-cleanups that fall out of the moves**: delete `lib/api/index.ts` (unused one-line re-export); add a `getOwnedDomain(session, id)` helper to collapse the ownership-404 check copy-pasted across the get/verify/delete route handlers.
- **Audit sweep (from /ponytail-audit)**: delete zero-caller code — `getDomainsByStatus`, `resolveNs/Mx/Srv`, `checkTrigger`/`checkOutcome` enums + commented `checks` table, `dkimSelector` env var, ~45 lines of commented-out corpses, `result || []` after `.execute()`; inline `sessionQueryOptions`; replace `dotenv` with `process.loadEnvFile()`; drop the redundant `pg` + `@types/pg` driver pair if `drizzle-kit` verifies against `postgres` alone. Net ≈ −190 lines, up to −3 deps.

Out of scope: no behavior, API, or schema changes of any kind (the `onError` consolidation makes previously-inconsistent error responses uniform, which the specs already assumed).

## Capabilities

### New Capabilities

- `module-boundaries`: the enforced server/client import boundary — server-only modules must fail the build when reached from client code, and the shared contract module must stay importable from both sides.

### Modified Capabilities

None — no requirement-level behavior changes to existing capabilities; all existing specs remain accurate.

## Impact

- **Moved/renamed files**: `lib/api/helpers.ts` → `lib/errors.ts` (trimmed), `db/validationschemas.ts` → `shared/domain.ts`, new `shared/api.ts` + `shared/types.ts` + `db/client.ts`, deleted `lib/api/index.ts`.
- **Import updates** across: `db/*`, `domain/*` (+ 5 test files), `lib/api/**`, `hooks/*`, `lib/strings.ts`, `components/*`, the domain detail page.
- **New dependency**: `server-only` (official Next.js package, zero runtime cost).
- **Risk**: wide but mechanical import churn; the 45-test suite + typecheck are the safety net. No DB or API surface changes.
