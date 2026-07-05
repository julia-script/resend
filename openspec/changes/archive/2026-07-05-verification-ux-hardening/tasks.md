# Tasks — verification-ux-hardening

## 1. Config foundation

- [x] 1.1 Add env vars with defaults to `src/lib/env.ts`: `PENDING_RECHECK_MS`, `SUCCESS_RECHECK_MS`, `GRACE_PERIOD_MS`, `GRACE_PERIOD_WARNING_MS`, `VERIFICATION_WINDOW_MS`, `NOTIFICATIONS_FROM` (z.coerce.number / string, defaults = current constants)
- [x] 1.2 Move timing constants into env entirely (no re-exports): `verification.ts`, tests, and the verify route read `env.*`; `notifications.ts` uses `env.notificationsFrom`; all 38 tests pass
- [x] 1.3 Add `vercel.json` scheduling `GET /api/cron/verify` every minute

## 2. Verify lifecycle (restart, rotate, instant check)

- [x] 2.1 Add `verifyAction(domain)` pure helper to `verification.ts` (`start` | `restart` | `rotate` | `check` — dropped the planned `null`: every status maps to an action) + unit tests for every status/reason combo
- [x] 2.2 Add `rotateDomainKeys(id, {selector, publicKey, privateKey})` to `src/db/domains.ts` (encrypts private key, returns updated row)
- [x] 2.3 Rewrite `POST /domains/{id}/verify` handler: switch on `verifyAction`; start/restart set `in_progress` + fresh deadline; rotate generates new DKIM keys first; then run throttled instant check via `verifyDomain` + `dispatchNotifications`; return post-check domain
- [x] 2.4 Implement the checkLog-based throttle (`isCheckThrottled` pure helper, 30 s) and cover it with a test
- [x] 2.5 Curl-verify all paths live: not_started, failed/expired, failed/superseded (record changes), double-click throttle

## 3. Domain management (claim + delete)

- [x] 3.1 `POST /domains`: return 409 `domains/name_taken` when name is verified by another account and `enforce` is false; create normally when `enforce: true`; add 409 to the OpenAPI route (also: `getDomainByName` → `getDomainsByName`, multi-user names need all rows)
- [x] 3.2 Create form: catch 409 via `isResponseError`, show takeover warning inline, resubmit with `enforce: true` on confirm
- [x] 3.3 Add `deleteDomain(id)` to `db/domains.ts` and `DELETE /domains/{id}` route (ownership 404 like siblings)
- [x] 3.4 Detail page: "Remove domain" button with `window.confirm`, then navigate to list and invalidate queries
- [x] 3.5 Curl-verify: 409 → enforce flow, delete own domain, 404 deleting foreign id — plus full browser walkthrough of claim and remove

## 4. Cron hardening

- [x] 4.1 Switch sweep to `Promise.allSettled`; log rejected, dispatch fulfilled notifications, respond `{ok, checked, failed}`
- [x] 4.2 Live-check the endpoint still returns 200 with a healthy sweep (also fixed: verified domains were never swept, so grace-period monitoring was unreachable — `getDomainsDueForCheck` now includes `verified`)

## 5. Detail-page UX

- [x] 5.1 Poll with `refetchInterval` callback: ~5 s while `in_progress` or grace period active, `false` otherwise; verify a status flip appears without refresh
- [x] 5.2 Verify mutation: seed cache with returned domain, button states per status (`failed/superseded` → "Get a new record & re-verify"); server now returns the updated domain (rotation payload arrives with task 2.3)
- [x] 5.3 Plain-language `statusReason` explanations under the badge for every failed reason
- [x] 5.4 Humanized recent check history from `checkLog` (newest first, relative times, capped display)
- [x] 5.5 Collapsible beginner DNS guide (`<details>`), friendly + lightly funny, referencing the exact record name/value on the page
- [x] 5.6 Browser-verify the page in the preview: polling, reasons, guide verified end-to-end (remove button + rotation land with groups 2/3)

