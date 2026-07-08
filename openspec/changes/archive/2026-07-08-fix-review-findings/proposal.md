# Fix Review Findings

## Why

An external code review surfaced defects that undermine trust in the project: a fresh `pnpm test` fails (undocumented env, live-Postgres dependency, DKIM tests pinned to third-party live DNS that has rotted), status transitions race between the cron sweep and manual verify (double notification emails, duplicate-create 500s), and user-facing UI misses accessibility basics that the dev-only console already gets right. Several smaller hardening items round it out.

## What Changes

- **Test hygiene**: make the suite hermetic — the two DKIM tests use the existing mock-DNS injection point (`mockRecord` param in `src/domain/dkim.ts`) instead of live `jlort.com` DNS; the live-Postgres test (`src/db/domains.test.ts`) is skipped automatically when `DATABASE_URL` is absent; required env for tests is documented and `vitest.config.ts` tolerates a missing `.env`.
- **Concurrency**: status transitions become compare-and-swap (`UPDATE ... WHERE status = <expected>`), so a cron tick racing a manual verify can no longer both observe the same transition and double-send notification emails; notifications dispatch only when the CAS write wins. Duplicate domain create catches the `(userId, name)` unique violation and returns the existing row with 200 (matching the sequential duplicate path) instead of 500. `supersedeOthers` runs in a `db.transaction`.
- **Accessibility**: label the sign-in email input and the domain-create input; add `aria-live`/`role="alert"` to form errors and the copy-button "Copied" feedback; surface delete failures (currently silent in `RemoveButton`/`useDeleteDomain`).
- **Smaller items**:
  - DKIM keys deliberately stay RSA-1024; the postmortem page documents why (per [Resend's own guidance](https://resend.com/docs/knowledge-base/do-i-need-2048-dkim): 2048 hits DNS TXT length/splitting edge cases at some providers, gets no deliverability reward, and 1024 meets current RFC and Google/Yahoo/Microsoft bulk-sender requirements).
  - Mock console is hard-blocked in production builds (`NODE_ENV === "production"`), not just gated by `ENABLE_MOCK`.
  - Add a real `not-found.tsx` so the existing `notFound()` calls render a branded 404 instead of Next's default.

## Capabilities

### New Capabilities
- `test-hygiene`: the test suite passes on a fresh clone — hermetic DNS via the mock injection point, DB-dependent tests gated on env presence, env requirements documented.
- `accessible-feedback`: user-facing UI never fails silently or invisibly — inputs have labels, errors and copy feedback are announced to assistive tech, delete failures show a message, unknown routes get a branded 404 page.
- `mock-console-gating`: the mock DNS/email console is unreachable in production regardless of env configuration.

### Modified Capabilities
- `domain-verification-lifecycle`: status transitions are atomic (compare-and-swap); each transition's notifications are sent at most once even under concurrent cron/manual checks; supersede revocations are transactional; RSA-1024 DKIM keys are codified as a deliberate, documented choice.
- `domain-management`: concurrent duplicate create behaves like the sequential duplicate path (200 with the existing row), never a 500; delete failures are visible.

## Impact

- **Tests**: `src/domain/dkim.test.ts`, `src/db/domains.test.ts`, `vitest.config.ts`, README env docs.
- **Concurrency**: `src/db/domains.ts` (`updateDomain`, `insertDomain`), `src/domain/verification.ts` (`transition` consumers, `supersedeOthers`), `src/lib/api/cron/verify.ts`, `src/lib/api/domains/verify.ts`, `src/lib/api/domains/create.ts`.
- **UI**: `src/components/auth/SignIn.tsx`, `src/components/Domains.tsx`, `src/app/(protected)/domains/[id]/CopyButton.tsx`, `RemoveButton.tsx`, `src/hooks/domains.ts`, new `src/app/not-found.tsx`.
- **Hardening**: `src/lib/env.ts` / `src/app/(protected)/mocks/*` (production block), `src/app/docs/postmortem/page.tsx` (DKIM key-size rationale).
- **Behavior change**: none to the API surface — duplicate-create's 500 becomes the same 200 the sequential duplicate path already returns. DKIM key generation is unchanged.
