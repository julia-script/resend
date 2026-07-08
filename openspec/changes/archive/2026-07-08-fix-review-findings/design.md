# Design — fix-review-findings

## Context

External review findings against a working codebase. The state machine (`transition()` in [verification.ts](../../../src/domain/verification.ts)) is already pure and already gates notifications on "update affected a row" — but the UPDATE matches on `id` only, so two concurrent checks that read the same prior state both persist and both emit events. Tests already have a mock-DNS injection point (`mockRecord` on `checkDkim`) that the DKIM tests bypass in favor of live DNS on `jlort.com`. Drizzle ORM over postgres-js; `db.transaction()` is available but unused.

## Goals / Non-Goals

**Goals:**
- `pnpm test` green on a fresh clone, offline, without `.env`.
- At-most-once notifications per state transition under concurrent cron/manual checks.
- Duplicate-create race returns the same response as the sequential duplicate path.
- Labels, live regions, visible delete errors, branded 404, production-blocked mocks, documented DKIM key-size decision.

**Non-Goals:**
- No advisory locks, job queues, or outbox pattern — CAS on the read state is sufficient for at-most-once here.
- No move to RSA-2048 DKIM keys — deliberately declined, see decision 5.
- No full WCAG audit — only the reviewed gaps.

## Decisions

### 1. CAS = optimistic guard on the fields the transition read
`updateDomain(id, update)` gains an optional `guard` argument: `{ status, gracePeriodStartedAt, gracePeriodWarningSentAt }`, added to the WHERE clause (with `IS NULL` handling for null timestamps). `verifyDomain` passes the values from the `domain` row it computed the transition from. A writer whose guard no longer matches gets `null` back and the existing "nothing persisted → announce nothing" path handles it — no new control flow.

Guarding on all three read fields (not just `status`) is deliberate: `verified → verified` transitions (grace-period start, grace-period warning) don't change status, so status-only CAS would still double-send `notifyGracePeriodWarning`. The three fields are exactly the state `transition()` branches on for event emission.

*Alternative considered:* a `version` column bumped on every write — stronger (also serializes log-only writes) but needs a migration, and serializing no-event retry checks buys nothing. Rejected.

*Trade-off:* the losing check's log entry is dropped. Spec explicitly allows this ("a check cycle that fails to persist MAY be lost silently").

The manual-verify start/restart path (`api/domains/verify.ts`) passes the same guard for its `→ in_progress` writes, so a double-clicked verify can't double-start either.

### 2. supersedeOthers in one transaction
`updateDomain` (and only it) accepts an optional executor (`tx` or `db`, defaulting to `db`). `supersedeOthers` wraps its revoke loop in `db.transaction()`. Notifications are still built only from rows whose revoke persisted, and only after the transaction commits. Removes the `ponytail: not transactional` comment.

### 3. Duplicate create: catch 23505, re-fetch, return 200
`insertDomain` detects postgres error code `23505` and rethrows as a tagged `ApiError` (`db/domain_exists`). `createDomainHandler` catches that tag, re-fetches via the existing `getDomainByNameAndUserId`, and returns 200 — identical to the sequential `mine` path a few lines above. No schema change; the unique constraint on `(userId, name)` already exists.

### 4. Hermetic tests via the existing mock seam
- `dkim.test.ts`: replace the two live-DNS tests with `checkDkim({..., domain: "example.mock", mockRecord})` cases (`isMockDomainName` requires "mock" in the name). Cover success, key-mismatch, ENODATA, ENOTFOUND — all offline. Public keys in fixtures are generated in-test via `generateDkimKeys()`.
- `vitest.config.ts`: `try { process.loadEnvFile() } catch {}` so a missing `.env` is fine.
- `env.ts` itself branches on `NODE_ENV === "test"` (vitest sets it): the schema parses a copy of `process.env` with secret placeholders forced, `DATABASE_URL` defaulted only if absent, and timing overrides stripped — so demo-short values in a dev `.env` never change what tests assert. No setup file, no `process.env` mutation.
- `db/domains.test.ts`: `describe.skipIf(!process.env.DATABASE_URL)` so the Postgres integration test skips visibly instead of failing (the placeholder URL exists only in the parsed env object, never in `process.env`).
- README: one paragraph — tests run standalone; set `DATABASE_URL` to also run the DB integration suite.

### 5. Hardening: keep RSA-1024, block mocks in production
- **DKIM stays RSA-1024, documented**: the review flagged 1024 as below the 2048 norm, but [Resend's own guidance](https://resend.com/docs/knowledge-base/do-i-need-2048-dkim) recommends 1024: 2048-bit `p=` values exceed the 255-char TXT string limit and must be split, which some DNS providers mishandle (a real verification-failure source for exactly this product's core flow); inbox providers don't reward 2048 with better placement; and 1024 meets current RFC guidance and Google/Yahoo/Microsoft bulk-sender requirements. Rather than inherit those edge cases, we keep 1024 and make the decision legible: a comment on `DKIM_MODULUS_LENGTH` linking the rationale, and a short section in the postmortem page (`src/app/docs/postmortem/page.tsx`) explaining the trade-off and when 2048 would be reconsidered (e.g. providers start mandating it).

  *Alternative considered:* generate 2048 and split the TXT value into chunks in the DNS instructions — handles the length limit but not providers that mishandle multi-string values, and adds UI complexity for zero deliverability gain. Rejected.
- **Mock console production block**: in `env.ts`, `enableMock` transform also requires `process.env.NODE_ENV !== "production"`. Every consumer (mocks page, server actions, nav link, `verifyDomain`'s `mockRecord`) already reads `env.enableMock`, so one guard covers all of them.

### 6. Accessibility: copy the pattern the codebase already has right
`MocksClient.tsx` already does `<label htmlFor>` + `id` — apply the same to `SignIn.tsx` and `Domains.tsx`. Errors and the claim warning get `role="alert"`; `CopyButton` wraps its label in `aria-live="polite"`. `RemoveButton` renders `remove.error` in a `role="alert"` element (the mutation already exposes it; it's just never shown). New `src/app/not-found.tsx` with the app shell and a link home.

## Risks / Trade-offs

- [Guard drops concurrent no-event log entries] → acceptable per spec; the atomic jsonb append still protects entries from writers that pass the guard.
- [Null-timestamp guards need `isNull` vs `eq`] → small helper in `updateDomain`; covered by a unit test of the guard SQL behavior in the DB integration suite.
- [Keeping RSA-1024 may be flagged again by future reviewers] → the postmortem section and code comment exist precisely to preempt that; the decision cites the ESP's own published guidance.
- [Placeholder env values could mask a real misconfiguration in tests that intend to use env] → placeholders only fill *missing* vars; a present `.env` wins.
- [`NODE_ENV !== "production"` also blocks mocks in production-mode E2E smoke runs] → acceptable; that's the point of a hard block.

## Migration Plan

Pure code changes, no DB migration. Deploy is one release; rollback is revert.

## Open Questions

None.
