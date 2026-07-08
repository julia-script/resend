# Tasks — fix-review-findings

## 1. Test hygiene (hermetic suite)

- [x] 1.1 `vitest.config.ts`: wrap `process.loadEnvFile()` in try/catch; add `test.setupFiles: ["test/setup.ts"]`
- [x] 1.2 `src/lib/env.ts`: in test mode (`NODE_ENV === "test"`), parse a copy of `process.env` with secret placeholders forced, `DATABASE_URL` defaulted only if absent, and timing overrides stripped
- [x] 1.3 `src/domain/dkim.test.ts`: replace the two live-DNS tests (`jlort.com`) with hermetic `checkDkim` cases using a `*.mock` domain and injected `mockRecord` — cover success, key mismatch, ENODATA (record not found), ENOTFOUND (domain not found)
- [x] 1.4 `src/db/domains.test.ts`: gate the Postgres suite with `describe.skipIf(!process.env.DATABASE_URL)`
- [x] 1.5 README: document that `pnpm test` runs standalone and that setting `DATABASE_URL` additionally runs the DB integration tests
- [x] 1.6 Verify: `mv .env .env.bak && pnpm test` is green offline, then restore `.env` and confirm the DB suite runs again

## 2. Concurrency (CAS + transaction + duplicate create)

- [x] 2.1 `src/db/domains.ts`: add optional `guard: { status, gracePeriodStartedAt, gracePeriodWarningSentAt }` to `updateDomain`, ANDed into the WHERE clause with `isNull` handling for null timestamps; add optional executor param (`db` default) for transaction use
- [x] 2.2 `src/domain/verification.ts` `verifyDomain`: pass the guard built from the `domain` row the transition was computed from — losing writers get `null` and the existing "announce nothing" path applies
- [x] 2.3 `src/lib/api/domains/verify.ts`: pass the guard on the start/restart `→ in_progress` writes so a double-clicked verify can't double-start
- [x] 2.4 `src/domain/verification.ts` `supersedeOthers`: wrap the revoke loop in `db.transaction()`, build notifications only from persisted revokes after commit; delete the `ponytail: not transactional` comment
- [x] 2.5 `src/db/domains.ts` `insertDomain`: detect postgres `23505` and rethrow as tagged `db/domain_exists`
- [x] 2.6 `src/lib/api/domains/create.ts`: catch `db/domain_exists`, re-fetch via `getDomainByNameAndUserId`, return 200 with the existing row
- [x] 2.7 Tests: unit-test that `transition` consumers skip notifications when the guarded update returns null; extend the DB integration suite with a guard test (update with stale status affects zero rows) and a duplicate-insert test (second insert → `db/domain_exists`)

## 3. Accessibility & feedback

- [x] 3.1 `src/components/auth/SignIn.tsx`: associate a `<label htmlFor>` with the email input (visually hidden is fine, pattern from `MocksClient.tsx`)
- [x] 3.2 `src/components/Domains.tsx`: label the domain-name input; add `role="alert"` to the error message and claim-conflict warning
- [x] 3.3 `src/app/(protected)/domains/[id]/CopyButton.tsx`: wrap the button label in an `aria-live="polite"` region so "Copied" is announced
- [x] 3.4 `src/app/(protected)/domains/[id]/RemoveButton.tsx`: render `remove.error` in a `role="alert"` element so a failed delete shows a message and the user stays on the page
- [x] 3.5 Create `src/app/not-found.tsx`: branded 404 with the app shell and a link back to the domain list

## 4. Hardening

- [x] 4.1 `src/domain/dkim.ts`: comment on `DKIM_MODULUS_LENGTH` marking 1024 as deliberate, linking https://resend.com/docs/knowledge-base/do-i-need-2048-dkim
- [x] 4.2 `src/app/docs/postmortem/page.tsx`: add a short "Why RSA-1024 DKIM" section — TXT 255-char split edge cases at some DNS providers, no deliverability reward for 2048, meets RFC + Google/Yahoo/Microsoft bulk-sender requirements; note when 2048 would be reconsidered
- [x] 4.3 `src/lib/env.ts`: `enableMock` transform additionally requires `process.env.NODE_ENV !== "production"`
- [x] 4.4 Verify the production block: with `NODE_ENV=production ENABLE_MOCK=true`, the mocks page 404s and no nav link renders

## 5. Verification pass

- [x] 5.1 `pnpm test` green with and without `.env` / `DATABASE_URL`
- [x] 5.2 `pnpm build` passes (server-only boundaries intact, not-found page compiles)
- [ ] 5.3 Manual smoke: create → verify (mock domain) → copy button announces → delete failure shows error. (Done live: signin label, branded 404, postmortem section. Remaining flows are behind magic-link auth — needs a signed-in manual pass.)
