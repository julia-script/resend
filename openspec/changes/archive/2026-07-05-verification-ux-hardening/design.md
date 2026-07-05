# Design — verification-ux-hardening

## Context

The verification core is done and tested: `transition()` (pure state machine) + `verifyDomain()` (check → persist → collect notifications) in `src/domain/verification.ts`, a cron sweep at `GET /api/cron/verify`, batched Resend notifications in `src/domain/notifications.ts`, and a Hono/zod-openapi API under `src/lib/api/domains/`. The gaps are at the edges: the verify route only handles `not_started`, failed states are dead ends, the UI is static, and several deploy-readiness details are hardcoded.

Constraints: take-home scope (favor small diffs and native/platform features), existing 38 tests must stay green, dev DB is disposable but schema churn should stop now.

## Goals / Non-Goals

**Goals:**
- Every failure state has a user-visible path forward, with the right security semantics per reason.
- The verify button gives instant, spam-proof feedback; the page updates itself while anything is pending.
- The sweep survives per-domain failures and is deployable (vercel.json, env-tunable timings).
- Non-technical users can follow the DNS setup without leaving the page.

**Non-Goals:**
- README/docs overhaul and CI (explicitly deferred).
- Outbox/idempotency for notification delivery (accepted loss on crash mid-sweep).
- The `canceled` status reason flow — replaced by hard deletion.
- Sending-domain features beyond verification (SPF/MX, actual email API).

## Decisions

1. **Verify-action decision as a pure helper.** A small exported `verifyAction(domain): "start" | "restart" | "rotate" | "check" | null` in `verification.ts` decides what `/verify` does; the route stays glue. Rationale: keeps the security-relevant branching unit-testable like the rest of the state machine. Alternative (logic inline in the handler) rejected — that's how the transitions ended up in the cron file last time.

2. **Rotation only for `superseded`.** `expired`/`grace_period_expired` restart with existing keys (the record may simply have arrived late or come back). `superseded` regenerates selector + keypair via a new `rotateDomainKeys` DB helper (key fields are deliberately not in `DomainUpdate`), because the previous owner's proven DNS control means the old record must never validate again. Alternative (rotate on every restart) rejected: forces needless DNS edits on users whose record just propagated slowly.

3. **Instant check reuses `verifyDomain`, throttled by `checkLog`.** The route runs `verifyDomain` + `dispatchNotifications` for the single domain. Throttle: skip the check if the newest `checkLog` entry is younger than ~30 s — no new columns, no rate-limit dependency, per-domain by construction. Alternative (rate-limit middleware) rejected as a new moving part for one button.

4. **Polling via react-query `refetchInterval` callback.** `refetchInterval` returns ~5 s while `in_progress` or grace-period-active, `false` otherwise. No websockets/SSE — the state changes at most once a minute via cron; polling a cheap GET is proportionate.

5. **Claim flow = 409 + explicit resubmit.** `POST /domains` returns `409 domains/name_taken` (only when the name is verified by another account and `enforce` is false). The form catches it via up-fetch's `isResponseError`/`error.data` and renders an inline confirm that resubmits with `enforce: true`. The takeover itself stays where it already lives — the supersede sweep on successful verification. Alternative (separate `/claim` endpoint) rejected: same operation, one more route to secure.

6. **Deletion is a hard DELETE.** `deleteDomain` in `db/domains.ts`, `DELETE /domains/{id}` route, `window.confirm` on the detail page (native beats a modal component for a take-home). FK cascade already ties domains to users; nothing else references domains.

7. **Timings via env with schema defaults.** `PENDING_RECHECK_MS`, `SUCCESS_RECHECK_MS`, `GRACE_PERIOD_MS`, `GRACE_PERIOD_WARNING_MS`, `VERIFICATION_WINDOW_MS`, `NOTIFICATIONS_FROM` parsed with `z.coerce.number()` defaults equal to today's constants. The constants move to env entirely — `verification.ts` and tests read `env.*` directly, no re-exports (per review).

8. **Sweep isolation with `allSettled`.** `Promise.allSettled` over `verifyDomain`; fulfilled results feed the batch dispatch, rejected ones are logged and counted in the response (`{ok, checked, failed}`).

## Risks / Trade-offs

- [Instant check runs DNS on the request path] → 5 s timeout already exists in the resolver; throttle bounds frequency; worst case the route is slow once per 30 s per domain.
- [Rotation changes the record while the page shows the old one] → the verify mutation response carries the rotated domain; UI must render the new selector/value from the response (covered by a spec scenario).
- [`enforce: true` creates duplicate names across users] → already supported by the `(userId, name)` unique constraint; the supersede sweep resolves the race; claim UI copy must make the consequence explicit.
- [Polling forever if a domain sticks in `in_progress`] → deadline transition guarantees a terminal state within the verification window; polling stops there.
- [Env-driven timings make prod/dev drift possible] → defaults match current behavior; values logged nowhere sensitive.

## Migration Plan

Pure addition on top of `main`; no schema migration (all enum values already exist). Deploy order irrelevant; `vercel.json` activates the sweep on first deploy. Rollback = revert the commit.

## Open Questions

- Throttle length (30 s proposed) — cheap to change, pick during implementation.
- Whether the claim confirm should also warn when the other copy is merely `in_progress` (current plan: only `verified` names 409; unverified duplicates just coexist and race).
