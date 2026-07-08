# postmortem-diagrams Specification

## Purpose

The postmortem page (`src/app/docs/postmortem/page.tsx`) documents domain-verification control flow using mermaid diagrams. This capability governs that those diagrams stay faithful to the handlers they describe and remain renderable.

## Requirements

### Requirement: Diagrams reflect the implemented control flow
The mermaid diagrams on the postmortem page (`src/app/docs/postmortem/page.tsx`) SHALL depict the control flow that the corresponding handlers actually implement. A diagram MUST NOT show a path that the code does not take, and MUST NOT omit a branch the code does take when that branch changes what the user observes (a check running, a notification sent, a status transition).

#### Scenario: Start Verification convergence
- **WHEN** the Start Verification diagram is read against `verifyDomainHandler`
- **THEN** the `start` (notStarted), `restart`, and `rotate` paths each perform their update and then converge on the same `isCheckThrottled` gate as the `check` path — routing to `verifyDomain` when not throttled and to the returned domain when throttled — with no path dead-ending before that gate

#### Scenario: Create Domain duplicate race
- **WHEN** the Create Domain diagram is read against `createDomainHandler`
- **THEN** it shows the concurrent-duplicate path where a second insert violates `(userId, name)`, is caught as `db/domain_exists`, and returns the existing row with 200

#### Scenario: State Transition supersede branch
- **WHEN** the State Transition diagram is read against `verifyDomain` and `transition`
- **THEN** a successful verification shows both the `notifyVerificationSucceeded` notification and the supersede branch that revokes other accounts' verified copies of the same name and notifies them (`notifyDomainSuperseded`)

### Requirement: Diagrams remain valid mermaid
Every diagram string SHALL render without a mermaid parse error on the page.

#### Scenario: Page renders all diagrams
- **WHEN** `/docs/postmortem` is loaded
- **THEN** each diagram renders as a diagram, with no mermaid error box in place of any of them
