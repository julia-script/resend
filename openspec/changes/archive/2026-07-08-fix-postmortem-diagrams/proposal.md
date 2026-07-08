## Why

The mermaid diagrams on the postmortem docs page (`/docs/postmortem`) are meant to document the real control flow, but the **Start Verification** diagram diverges from the code: it draws four independent paths that each dead-end at `returnDomain`, when the handler is actually linear — `start`, `restart`, and `rotate` all fall through to the same throttle-gated `verifyDomain` call that the `check` path uses. A reader trusting the diagram would believe a first-time verify never runs a DKIM check, which is the opposite of what happens. Two other diagrams have smaller drifts, one of them introduced by the just-merged `fix-review-findings` change.

## What Changes

- **Start Verification diagram** (`src/app/docs/postmortem/page.tsx`, `start_verification` section): redraw so `startVerification` (notStarted), `restartVerification`, and `rotateDomain` each flow through their update and then converge on the shared `isCheckThrottled` gate, which routes to `verifyDomain` when not throttled and to `returnDomain` when throttled — matching `verifyDomainHandler`. Fix the `startVerification` node, which currently has no outgoing edge at all.
- **Create Domain diagram** (`create_domain` section): add the idempotent duplicate-create path — a concurrent second insert hits the `(userId, name)` unique constraint, is caught as `db/domain_exists`, and returns the existing row (200) rather than erroring. This path was added by `fix-review-findings` and the diagram predates it.
- **State Transition diagram** (`transition` section): after `updateDomainVerified → notifyVerificationSucceeded`, show the supersede branch (`verifyDomain` revokes other accounts' verified copies of the same name and notifies them via `notifyDomainSuperseded`), which the diagram omits entirely.

No behavior changes — this is documentation-only, correcting diagrams to match existing code.

## Capabilities

### New Capabilities
- `postmortem-diagrams`: the postmortem page's mermaid diagrams stay faithful to the implemented control flow and remain valid mermaid.

### Modified Capabilities
<!-- No existing capability changes: this corrects documentation, not behavior. -->>

## Impact

- **File**: `src/app/docs/postmortem/page.tsx` — three of the five `sections[].graph` mermaid strings (`start_verification`, `create_domain`, `transition`).
- **No code, API, or dependency changes.** The `cron_verify` and `verify_domain` diagrams already match the code and are left untouched.
- Verification is visual: the rendered diagrams must parse in mermaid and read correctly against the handlers.
