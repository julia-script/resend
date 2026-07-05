# verification-hardening

## Why

A review pass found two integrity gaps in the verification core: concurrent checks can silently lose check-log entries (read-modify-write append), and notifications are emitted even when the state they announce failed to persist — a user could receive a "verified" email for a domain that isn't. Two smaller items ride along: the create-conflict lookup loads every row sharing a name (O(n) on popular names), and the Scalar API reference at `/api/reference` exists but is undiscoverable.

## What Changes

- Check-log appends move from JS array replacement to an atomic SQL `jsonb ||` concat (with the 100-entry cap applied in SQL), so a manual verify racing the cron sweep can no longer drop entries. `rotateDomainKeys` already does this; `updateDomain` follows suit.
- `verifyDomain` emits notifications only for transitions that actually persisted: if the domain update returns no row (e.g. deleted mid-check), no events fire; superseded-domain notifications are only produced for rows whose revoke update succeeded. A failed cron cycle is acceptable — a false "verified" email is not.
- Create-conflict check becomes O(1): replace `getDomainsByName` (all rows for a name) with two `LIMIT 1` lookups — the caller's own row, and existence of a verified copy. `getVerifiedDomainsByName` stays unlimited for the supersede sweep, which genuinely needs all rows.
- IDN handling: confirmed already correct (`new URL()` punycodes `münchen.de` → `xn--mnchen-3ya.de`; tldts accepts it). Lock it in with regression tests and make the behavior an explicit requirement.
- Header gains a link to the `/api/reference` API explorer.

Explicitly out of scope (deferred by owner): README, deployment, per-registrar DNS UX, accessibility/dialog work, RSA modulus (1024 is a deliberate compatibility choice).

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `domain-verification-lifecycle`: two added requirements — check-log appends are atomic under concurrent checks, and verification notifications are only emitted for persisted transitions.
- `domain-management`: added requirement — Unicode (IDN) domain names are normalized to their punycode ASCII form on create, so DNS instructions and lookups use the form DNS actually resolves.

(The header API-reference link is a cosmetic navigation addition with no spec-level behavior; covered in design/tasks only.)

## Impact

- `src/db/domains.ts` — `updateDomain` gains atomic check-log append; new narrow lookup(s) for create; `getDomainsByName` removed if unused after.
- `src/domain/verification.ts` — `verifyDomain` guards notifications on persist success; `supersedeOthers` filters to successful revokes; `appendLog` moves into SQL.
- `src/lib/api/domains/create.ts` — switches to the narrow lookups.
- `src/domain/dkim.test.ts` (or verification tests) — IDN normalization regression cases.
- `src/app/(protected)/layout.tsx` — header link to `/api/reference`.
- No schema migrations, no API contract changes, no new dependencies.
