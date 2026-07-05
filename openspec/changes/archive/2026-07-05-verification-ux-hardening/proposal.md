# Verification UX & Hardening

## Why

Domain verification works end-to-end (state machine, cron sweep, notifications), but it's a dead end for users the moment anything goes wrong: failed domains can't be retried, the UI never updates on its own, "Failed" gives no reason, and a non-technical user gets no help adding the DNS record. A handful of robustness gaps (cron error isolation, hardcoded timing constants, no cron schedule file) block deploying it.

## What Changes

- **Retry semantics per failure reason**: a failed domain becomes recoverable. `expired` and `grace_period_expired` restart verification with the existing DKIM key; `superseded` requires a key rotation (new selector + keypair) so the user must place a fresh DNS record before re-verifying.
- **Instant check on verify**: `POST /domains/{id}/verify` runs a real DKIM check immediately (reusing `verifyDomain`) instead of waiting for the next cron tick, with a per-domain throttle so the button can't be spammed into hammering DNS.
- **Real-time status feedback**: the domain detail page polls (react-query `refetchInterval`) while verification is active or a grace period is running, and stops on terminal states.
- **Friendly failure explanations**: `statusReason` rendered as plain-language text plus a humanized recent check history from `checkLog`.
- **Beginner DNS guide**: a step-by-step, lightly humorous explanation of adding a TXT record for users who have never touched DNS.
- **Domain removal**: `DELETE /domains/{id}` deletes the domain outright (replaces the never-built "cancel" concept). **BREAKING** for the schema direction: the `canceled` status reason path is dropped in favor of deletion.
- **Claim/takeover flow**: creating a domain name verified by another account returns a 409 warning; the UI asks for confirmation and resubmits with `enforce: true`, entering the normal verify race (winner supersedes).
- **Cron error isolation**: the sweep uses `Promise.allSettled` so one domain's DB/DNS failure can't fail the whole run or drop other users' notifications.
- **Env-tunable timings**: recheck intervals, grace period, warning delay, verification window, and the notification from-address move to env vars with the current values as defaults.
- **Vercel cron config**: `vercel.json` scheduling `GET /api/cron/verify` every minute (Pro/trial plan).

Out of scope (deferred by decision): README/docs overhaul, CI setup.

## Capabilities

### New Capabilities
- `domain-verification-lifecycle`: how verification starts, restarts after each failure reason, rotates keys after supersede, throttles manual checks, and which timings are configurable.
- `domain-management`: creating, claiming (409 + enforce confirmation), and deleting domains.
- `verification-feedback-ui`: live status polling, plain-language failure reasons, check history display, and the beginner DNS guide.
- `cron-verification-sweep`: the scheduled sweep contract — cadence, auth, per-domain error isolation, batched notifications.

### Modified Capabilities

None (no existing specs; this change introduces the first ones).

## Impact

- **API**: `POST /domains/{id}/verify` behavior expands (restart/rotate/instant check); new `DELETE /domains/{id}`; `POST /domains` gains a 409 response; cron handler switches to `allSettled`.
- **DB**: new helpers (`rotateDomainKeys`, `deleteDomain`); no schema changes expected (`superseded`/`expired` reasons already exist).
- **Domain layer**: `verification.ts` gains a small pure "what does verify do for this status/reason" decision helper; timing constants read from env.
- **UI**: domain detail page (polling, reasons, history, DNS guide, remove button, rotated-record state) and the create form (claim confirmation).
- **Config**: `src/lib/env.ts` grows ~6 optional vars with defaults; new `vercel.json`.
- **Tests**: new cases for retry/rotation decisions, throttle, claim flow, and sweep isolation; existing 38 tests must stay green.
