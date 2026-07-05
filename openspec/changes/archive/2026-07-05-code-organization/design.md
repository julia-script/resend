# Design — code-organization

## Context

The app works and is tested (45 tests), but the module layout accreted during fast iteration. Three structural issues: (1) the server/client boundary is documented in a comment on `db/validationschemas.ts` rather than enforced — a client import of the db chain already caused one `Can't resolve 'fs'` crash this project; (2) `ApiError`/`Result` live in `lib/api/helpers.ts` although `db/` and `domain/` depend on them, producing a `db → lib/api → db` layering loop; (3) names lie: `validationschemas.ts` is the shared wire contract, `schema.ts` is tables *plus* the connection pool.

Constraint: zero behavior change — this must be a pure move/rename with the test suite and typecheck as the invariant.

## Goals / Non-Goals

**Goals:**
- Layering readable from the file tree; strictly one-directional imports.
- Build-time enforcement of the server/client split.
- Kill the naming lies without churning the parts that already read well (`domain/` core, one-file-per-endpoint routes).

**Non-Goals:**
- The parked dead-code sweep (separate pass).
- Feature-folder restructuring, barrels, or a service layer.
- Any API, DB, or behavior change.

## Decisions

1. **`server-only` package over directory conventions.** One import line per server module; Next.js fails the compile on client reachability. Alternative (move everything under `src/server/`) rejected: bigger churn, and the guard still wouldn't be mechanical.

2. **`lib/errors.ts` owns `ApiError` + `Result` + `mapToValue`.** Everything below the routes may import it; nothing in it imports anything. This makes layers strictly: `shared ← db ← domain ← lib/api ← app`. `lib/api/helpers.ts` is deleted (its remaining content was already dead). Alternative (leave ApiError, accept the loop) rejected: the loop is exactly the kind of thing a reviewer greps for.

3. **`src/shared/domain.ts` for the wire contract.** New top-level `shared/` directory signals "isomorphic by design"; the module keeps its no-server-imports rule and gains the *inability* to break it silently (importing a guarded module would fail the build). Alternative (rename in place under `db/`) rejected: the contract isn't a db concern — the db *implements* it.

4. **`db/client.ts` for the pool.** `schema.ts` keeps tables + pgEnums only. Queries import both; drizzle-kit config keeps pointing at `schema.ts`. The globalThis dev-singleton moves as-is.

5. **`getOwnedDomain(session, id)` in `lib/api/domains/shared.ts`** (or inline in each file — decided at implementation by size): fetch + ownership check returning the domain or null; handlers keep their own 404 response so route shapes stay explicit.

6. **`shared/api.ts` = per-endpoint schema objects, not just an envelope helper.** A bare `envelope(schema)` helper would still let client and server drift by wrapping different things; exporting named objects (`DomainResponseSchema`, `DomainListResponseSchema`, `DeleteDomainResponseSchema`, `CreateDomainInputSchema`, `CronSweepResponseSchema`) makes the wire contract greppable and shared verbatim by both sides. An `envelope()` helper may exist internally. Route *param* schemas (`z.object({ id: z.uuid() })`) stay inline in route files — they're server routing concerns, not wire contracts the client validates.

7. **`app.onError` over per-route Result plumbing.** `ApiError.mapToValue` exists so two of five handlers can convert thrown `ApiError`s into JSON; the other three let them leak as text 500s. Hono's `onError` hook does this once for every route, present and future. `Result` stays (the DKIM check uses it as a *value*, feeding the state machine — that's legitimate); only the route-level throw-to-Result adapter dies. Alternative (adopt `mapToValue` everywhere) rejected: five wrappers doing what the framework does in one.

8. **`shared/types.ts` for generic type utilities.** `RequiredBy` moves there; `MaybeResultPromise` stays private to `lib/errors.ts` (implementation detail of `mapToValue`); `Result` stays exported from `lib/errors.ts` next to `ApiError` since they're one vocabulary — `shared/types.ts` is for domain-agnostic helpers only. Rule of thumb recorded: a type used by two+ modules and tied to no domain concept goes in `shared/types.ts`.

9. **Fallow follow-up decisions (added during apply).** `postgres` stays despite the unused-dependency flag — drizzle loads it dynamically (`.fallowrc.jsonc` documents this). `decryptPrivateKey` stays despite zero callers — it is the only reader of the `privateKeyEncrypted` column and dies the day real sending ships, not before. `transition`'s complexity is accepted: it is the domain itself and the best-tested unit in the repo. `DomainPage`'s CRITICAL hotspot is accepted for now under the standing "page-local until it grows again" rule.

## Risks / Trade-offs

- [Wide import churn] → mechanical, done by search-replace; tsc catches stragglers; tests must stay 45/45.
- [`server-only` breaks vitest] → vitest imports server modules outside a Next build; the package's guard is a no-op outside Next's bundler in Node by default (it throws only when the `react-server`/client condition mismatches). If vitest resolves the client build of `server-only`, alias it to a stub in `vitest.config.ts` — a known one-line fix.
- [Type-only imports from server modules] (e.g. `strings.ts` importing `VerifyAction`) → type-only imports are erased before the guard matters; keep them `import type`.
- [Git history readability] → use `git mv` where possible so renames are tracked.

## Migration Plan

Single commit, no deploy implications. Order: add dependency → create `lib/errors.ts` + `shared/domain.ts` + `db/client.ts` (moves) → update imports → add `server-only` guards → delete `helpers.ts`/`index.ts` → ownership helper → full suite + build.

## Open Questions

- None blocking. If `server-only` misbehaves under vitest, the alias-stub fallback is pre-approved by this design.
