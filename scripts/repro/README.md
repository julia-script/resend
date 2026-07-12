# Repro: domain-verification race (two accounts, one name, one cron sweep)

Reproduces the concurrency hazard in domain verification: when two accounts are
mid-verification for the **same domain name** and both come due in the **same
cron sweep**, the "only one account may hold a name verified" rule is enforced
by a read-then-write (`supersedeOthers` in `src/domain/verification.ts`) with no
database-level guarantee, so it misbehaves under concurrency.

## What it drives

The **real exposed entry point** — the `GET /api/cron/verify` route handler
(`cronVerifyHandler`) — mounted on a bare Hono router. The handler,
`getDomainsDueForCheck`, `verifyDomain`, `supersedeOthers`, and every DB write
are the shipped, unmodified code. `cronVerifyHandler` runs
`Promise.allSettled(domains.map(verifyDomain))`, i.e. both accounts' checks
concurrently in one tick.

Only two incidental things are faked, neither part of the race:

- **DNS** — supplied through the app's own `dnsMockRecord` + `ENABLE_MOCK` hook
  (the domain names contain `mock` so `isMockDomainName` activates it). This is
  the "except the mock page" the task asked for: we seed the mock record in the
  DB directly instead of using the mocks UI page.
- **Email** — the `resend` client is stubbed (`resend-stub.mjs`) to avoid an
  outbound HTTPS call; it just records the batches the sweep tried to send.

`hooks.mjs` is a Node resolve shim so plain Node can import the real
`server-only` / `@/…` modules.

## Run

Needs a Postgres with this repo's schema applied
(`drizzle/0000_cloudy_may_parker.sql`).

```bash
DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/repro/run.sh
TRIALS=600 DATABASE_URL=... ./scripts/repro/run.sh    # more samples
```

Each trial: create two users + two `in_progress`, due domains for one name, run
one cron sweep, classify the resting state, then clean up.

## What it shows (typical run, 600 sweeps)

```
BOTH_FAILED     ~56%   both rows revoked → status=failed/superseded (nobody owns the name)
SINGLE_OWNER    ~44%   one verified, the other superseded (the intended outcome)
BOTH_VERIFIED     0%   never persists

Both accounts reached `verified` in the same sweep (transient): 100%
Invariant "exactly one verified owner" broken at rest:          ~56%
```

- **The report's observation is real**: in a concurrent sweep both rows *do*
  flip to `verified` in the same tick — 100% of the time (proven from the
  persisted check logs, which show an `ok` entry for both before either is
  revoked).
- **It does not persist as two owners.** The second writer's `supersedeOthers`
  always sees the first (already committed) `verified` row and revokes it, so a
  lasting two-owner state is not reachable this way.
- **The lasting corruption is the opposite**: when both supersede reads observe
  each other verified, they revoke *each other*, leaving the name owned by
  **nobody** (`BOTH_FAILED`) and emailing both legitimate users that "another
  account verified your domain." This is the ~56%-per-sweep bug.
