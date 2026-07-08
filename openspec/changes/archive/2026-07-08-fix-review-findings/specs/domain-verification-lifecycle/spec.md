## ADDED Requirements

### Requirement: Compare-and-swap status transitions
Database updates that change a domain's `status` SHALL include the expected current status in the UPDATE's WHERE clause (compare-and-swap). A writer whose precondition no longer holds SHALL observe zero affected rows, treat its transition as not persisted, and emit no notifications. Two concurrent checks of the same domain MUST NOT both persist the same status transition.

#### Scenario: Cron tick races a manual verify
- **WHEN** a cron sweep and a manual verify concurrently compute the same `in_progress → verified` transition for one domain
- **THEN** exactly one writer's UPDATE matches the `status = 'in_progress'` precondition, and only that writer dispatches the "verified" notification — the user receives one email, not two

#### Scenario: Losing writer stays quiet
- **WHEN** a status-changing UPDATE affects zero rows because another writer transitioned the domain first
- **THEN** the losing writer sends no notifications and runs no supersede sweep

### Requirement: Transactional supersede sweep
The supersede sweep that revokes other accounts' copies of a newly verified domain name SHALL run inside a single database transaction: either all revoke updates commit or none do.

#### Scenario: One revoke fails mid-sweep
- **WHEN** a revoke update throws partway through superseding three other copies
- **THEN** the transaction rolls back, no copy is left revoked while others stand verified, and no superseded notifications are sent for the rolled-back updates

### Requirement: Documented RSA-1024 DKIM keys
DKIM keypairs SHALL remain 1024-bit RSA as a deliberate choice, and the rationale SHALL be documented in the postmortem docs page with a reference to Resend's guidance (2048-bit values hit DNS TXT length/splitting limits at some providers, earn no deliverability benefit, and 1024-bit satisfies current RFC guidance and Google/Yahoo/Microsoft bulk-sender requirements). The code MUST mark the key size as intentional so it doesn't read as an oversight.

#### Scenario: Reviewer questions the key size
- **WHEN** someone reads the postmortem page or the key-generation code
- **THEN** they find the documented rationale for 1024-bit keys and the conditions under which 2048 would be reconsidered

## MODIFIED Requirements

### Requirement: Notifications only for persisted transitions
Verification notifications SHALL be emitted only when the state transition they announce was persisted by the emitting writer's own UPDATE (compare-and-swap on the expected prior status, affecting exactly one row). If the update affects no row — because the domain was deleted mid-check or another writer already performed the transition — no events fire and no supersede sweep runs. Supersede notifications SHALL be emitted only for domains whose revoke update persisted. A check cycle that fails to persist MAY be lost silently; a notification for unpersisted state MUST NOT be sent, and the same transition MUST NOT produce notifications from more than one writer.

#### Scenario: Domain deleted mid-check
- **WHEN** a check succeeds but the domain row no longer exists at write time
- **THEN** no "verified" notification is sent and no other domains are superseded

#### Scenario: Revoke update affects no row
- **WHEN** the supersede sweep's revoke update for another account's domain affects no row
- **THEN** that account receives no "superseded" notification

#### Scenario: Concurrent writers, one email
- **WHEN** two concurrent checks both compute the same notifying transition for one domain
- **THEN** notifications for that transition are dispatched exactly once, by the writer whose compare-and-swap update won
