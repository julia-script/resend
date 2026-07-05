# verification-hardening — design

## Context

`verifyDomain` (src/domain/verification.ts) persists check outcomes via a read-modify-write: it reads `domain.checkLog`, appends entries in JS (`appendLog`), and writes the whole array back through `updateDomain`. A manual verify racing the cron sweep can each read the same base array and the second write drops the first's entries. Separately, notifications are built from the pre-write domain and emitted regardless of whether `updateDomain` persisted anything (it returns `null` when the row is gone, e.g. deleted mid-check), and `supersedeOthers` emits "superseded" notifications for rows whose revoke update may not have landed.

`rotateDomainKeys` already appends its log entry with a SQL `jsonb ||` concat — the precedent to generalize.

On the create path, `getDomainsByName` loads every row sharing a name to answer two yes/no questions. And `/api/reference` (Scalar) is live but unlinked.

## Goals / Non-Goals

**Goals:**
- No lost check-log entries under concurrent checks.
- No notification for a state transition that did not persist (a false "verified" email is the failure mode to kill; a wasted cron cycle is fine).
- O(1) create-conflict lookup regardless of how many accounts share a name.
- Regression tests proving IDN names normalize to punycode (already the behavior).
- `/api/reference` linked from the header.

**Non-Goals:**
- Full transactional supersede (accepted ceiling, see Risks).
- Optimistic locking / versioning on domains (the remaining verify-vs-cron race only affects timestamps and status fields both writers derive from the same check semantics; log entries are the data that must not be lost).
- Retry/backoff, IDN display niceties, any UI beyond the header link.

## Decisions

**1. `DomainUpdate.checkLog` becomes `appendCheckLog` with SQL-level concat.**
`updateDomain` translates `appendCheckLog: CheckLogEntry[]` into one expression that concatenates and caps in the database:

```sql
check_log = (
  SELECT coalesce(jsonb_agg(elem ORDER BY ord), '[]'::jsonb)
  FROM jsonb_array_elements(check_log || $new::jsonb) WITH ORDINALITY AS t(elem, ord)
  WHERE ord > jsonb_array_length(check_log || $new::jsonb) - 100
)
```

Append semantics replace replace-semantics entirely — the only callers passing `checkLog` today are `verifyDomain` and `supersedeOthers`, both of which append. The JS `appendLog` helper and the `CHECK_LOG_MAX_ENTRIES` read in verification.ts move to db/domains.ts (the cap lives where the write lives). `rotateDomainKeys` reuses the same expression builder, gaining the cap it currently lacks.

*Alternative considered:* plain `check_log || $new` and a periodic trim — rejected; the capped expression is one self-contained query, no second moving part.

**2. Gate notifications on persisted writes.**
- `verifyDomain`: if `updateDomain` returns `null`, return `{ domain, notifications: [] }` — no events, no supersede sweep.
- `supersedeOthers`: collect each revoke's `updateDomain` result and emit a notification only for rows where it returned a row. Keep `Promise.all`; a thrown DB error propagates, the caller (cron `allSettled` / verify handler) surfaces it, and no notifications for this domain are sent that cycle — matching the accepted failure mode.

**3. Create-conflict lookup goes narrow.**
Replace `getDomainsByName` with two `LIMIT 1` queries in db/domains.ts:
- `getDomainByNameAndUserId(name, userId)` — the caller's own row (backed by the existing `(userId, name)` unique index).
- `hasVerifiedDomainByName(name)` — `select id … where name = $1 and status = 'verified' limit 1`, returned as boolean. In create.ts the "mine" check runs first, so any verified copy found here belongs to someone else.

`getDomainsByName` is then unused and is deleted. `getVerifiedDomainsByName` (supersede sweep) stays unlimited — it genuinely needs every row.

**4. IDN: test, don't change.**
`normalizeDomainName` already punycodes via WHATWG `URL` (`münchen.de` → `xn--mnchen-3ya.de`) and `tldts.getDomain` accepts the ASCII form. Add regression cases (Unicode label, already-punycoded input, Unicode + trailing dot) so a future refactor can't silently lose it.

**5. Header link is a plain `<a>`.**
`/api/reference` is served by Hono, not a Next page — `next/link` prefetch would 404-noise or waste a request. A plain anchor styled like the existing header text, placed before `UserMenu`.

## Risks / Trade-offs

- [Supersede is not transactional: main domain can persist as verified while a revoke throws, leaving two verified copies until someone re-verifies] → Accepted; frequency is bounded by supersede being rare and revokes being single-row updates. Mark with a `ponytail:` comment naming the upgrade path (wrap sweep in `db.transaction`).
- [Status-field last-write-wins between manual verify and cron remains] → Accepted; both writers compute equivalent transitions from a fresh DNS check, and log entries — the irrecoverable data — are now append-only in SQL.
- [SQL cap expression is Postgres-specific] → Fine; the project is Postgres-only (drizzle + postgres driver, docker-compose).
