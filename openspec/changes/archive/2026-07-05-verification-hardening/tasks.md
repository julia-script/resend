# verification-hardening — tasks

## 1. Atomic check-log append (db layer)

- [x] 1.1 In src/db/domains.ts, add a capped jsonb-append SQL expression builder (concat + trim to `CHECK_LOG_MAX_ENTRIES`, moved here from verification.ts) and change `DomainUpdate`'s `checkLog` field to `appendCheckLog: CheckLogEntry[]`, translated to that expression inside `updateDomain`
- [x] 1.2 Reuse the same expression in `rotateDomainKeys` so its append gains the cap
- [x] 1.3 Update `verifyDomain` and `supersedeOthers` in src/domain/verification.ts to pass `appendCheckLog` and delete the JS `appendLog` helper
- [x] 1.4 Update the orchestrator tests (verification.orchestrator.test.ts) for the new update shape; add a test that two sequential appends both land and the cap holds

## 2. Notifications only for persisted transitions

- [x] 2.1 In `verifyDomain`, return `{ domain, notifications: [] }` when `updateDomain` returns null — no events, no supersede sweep
- [x] 2.2 In `supersedeOthers`, emit a notification only for rows whose revoke `updateDomain` returned a row; add a `ponytail:` comment naming the non-transactional ceiling and the `db.transaction` upgrade path
- [x] 2.3 Add orchestrator tests: deleted-mid-check domain produces no notifications; a revoke affecting no row produces no superseded notification

## 3. O(1) create-conflict lookup

- [x] 3.1 In src/db/domains.ts, add `getDomainByNameAndUserId(name, userId)` (limit 1) and `hasVerifiedDomainByName(name)` (select id, limit 1, boolean)
- [x] 3.2 Switch src/lib/api/domains/create.ts to the two narrow lookups; delete the now-unused `getDomainsByName`

## 4. IDN regression tests

- [x] 4.1 Add `normalizeDomainName` cases to src/domain/dkim.test.ts: `münchen.de` → `xn--mnchen-3ya.de`, already-punycoded passthrough, Unicode + trailing dot/uppercase

## 5. Header API-reference link

- [x] 5.1 Add a plain `<a href="/api/reference">` styled like the header text in src/app/(protected)/layout.tsx, before `UserMenu`

## 6. Verify

- [x] 6.1 `pnpm test` and `pnpm lint` pass; manually confirm the header link opens Scalar in dev
