# Tasks — fix-postmortem-diagrams

## 1. Start Verification diagram

- [x] 1.1 In `src/app/docs/postmortem/page.tsx` `start_verification` graph: give `startVerification` (notStarted) an update-to-in_progress node and route it to `isCheckThrottled`
- [x] 1.2 Reroute `restartVerification`'s `updateDomainInProgress` from `returnDomain` to `isCheckThrottled`
- [x] 1.3 Reroute `rotateDomain`'s `updateDomainWithNewKeys` from `returnDomain` to `isCheckThrottled`
- [x] 1.4 Confirm `isCheckThrottled` routes `[false] → verifyDomain → returnDomain` and `[true] → returnDomain`, and that `check`, `start`, `restart`, `rotate` all reach it

## 2. Create Domain diagram

- [x] 2.1 In the `create_domain` graph: add the concurrent-duplicate path — insert throws `db/domain_exists` on the `(userId, name)` unique violation, caught and resolved by returning the existing row (200)

## 3. State Transition diagram

- [x] 3.1 In the `transition` graph: after the successful-verification path, add the `supersedeOthers` branch (revoke other accounts' verified copies of the same name → `notifyDomainSuperseded`)

## 4. Verify

- [x] 4.1 Load `/docs/postmortem` on the dev server and confirm all five diagrams render with no mermaid parse-error box
- [x] 4.2 Re-read the three edited diagrams against `verifyDomainHandler`, `createDomainHandler`, and `verifyDomain`/`transition` to confirm no path is shown that the code doesn't take and no user-visible branch is omitted
