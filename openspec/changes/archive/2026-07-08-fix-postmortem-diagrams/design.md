# Design — fix-postmortem-diagrams

## Context

`src/app/docs/postmortem/page.tsx` holds five mermaid state diagrams in `sections[].graph` template strings, rendered by `<Diagrams>`. They document the domain-verification flow. An audit against the handlers found three drifts; two diagrams (`cron_verify`, `verify_domain`) are already correct.

The single significant error is **Start Verification**. The handler `verifyDomainHandler` (`src/lib/api/domains/verify.ts`) is linear:

```
action = verifyAction(domain)          // start | restart | rotate | check
if (action === "rotate")  → rotate keys        // falls through
if (action !== "check")   → update to in_progress (guarded)   // falls through
if (!isCheckThrottled(...)) → verifyDomain + dispatchNotifications
return domain
```

So `start`, `restart`, and `rotate` do their write **and then hit the same throttle gate** as `check`. The diagram instead draws them as three separate branches that each end at `returnDomain`, and leaves the `startVerification` node with no outgoing edge at all. The fix is to make the branches converge on the shared `isCheckThrottled` choice.

## Goals / Non-Goals

**Goals:**
- Start Verification diagram matches the linear converge-on-throttle flow.
- Create Domain diagram includes the idempotent duplicate-create path added by `fix-review-findings`.
- State Transition diagram shows the supersede branch after a successful verification.
- All diagrams still parse as mermaid.

**Non-Goals:**
- No changes to `cron_verify` or `verify_domain` diagrams — verified correct.
- No handler/behavior changes. Documentation only.
- Not reproducing every field of every update node — diagrams stay at their current abstraction level; only wrong/missing *paths* are corrected.

## Decisions

### 1. Start Verification: converge on the throttle gate
Restructure the `start_verification` graph so all three mutating actions flow into the existing `isCheckThrottled` choice rather than to `returnDomain`:

- `startVerification` (notStarted): give it the update-to-in_progress node it's currently missing, then `→ isCheckThrottled`.
- `restartVerification`: `→ updateDomainInProgress → isCheckThrottled` (was `→ returnDomain`).
- `rotateDomain`: `→ generateDkimKeys → updateDomainWithNewKeys → isCheckThrottled` (was `→ returnDomain`).
- `isCheckThrottled`: `[false] → verifyDomain → returnDomain`, `[true] → returnDomain` (already correct; now every mutating path feeds it).

Reuse the existing `verifyDomain:::link` node (it already deep-links to `#verify_domain`). `check` continues to enter at `isCheckThrottled` directly.

*Alternative considered:* keep four separate paths but add a `verifyDomain` node to each. Rejected — it duplicates the throttle logic three times and hides that all paths share one gate, which is the very thing the reader needs to see.

### 2. Create Domain: add the duplicate-race path
After the `createUnverified → returnDomain` success edge, add a branch: the insert can throw `db/domain_exists` (unique `(userId, name)` violated by a concurrent create), which is caught and resolved by returning the existing row (200). Model it as a choice on the insert outcome: success → returnDomain; `db/domain_exists` → returnDomain (existing row). Keep it minimal — one extra node and edge — so the diagram doesn't balloon.

### 3. State Transition: show the supersede branch
`verifyDomain` calls `supersedeOthers` after emitting `notifyVerificationSucceeded`. Add, off `notifyVerificationSucceeded` (or the `updateDomainVerified` success path), a `supersedeOthers` node that revokes other accounts' verified copies and fans out `notifyDomainSuperseded`. This is the one place the transition diagram hides a real, user-visible effect (another account gets an email). Keep `updateGraceStarted` as-is: it emits `notifyGracePeriodStarted`, which has no template and sends no email, so "no notification shown" is accurate in effect.

## Risks / Trade-offs

- [A restructured mermaid graph could introduce a parse error] → verify by loading `/docs/postmortem` in the running dev server and confirming each diagram renders (no mermaid error box), per the spec's render scenario.
- [Adding the supersede/duplicate branches could clutter the diagrams] → keep additions to the minimum nodes needed to show the path; don't re-expand collapsed detail elsewhere.
- [Diagrams drift again as code changes] → out of scope to automate; the new `postmortem-diagrams` spec at least records the intent so a future reviewer can check.

## Migration Plan

Single edit to `page.tsx`. No migration, no rollback concern beyond `git revert`.

## Open Questions

None.
