# domain-verification-lifecycle — delta

## ADDED Requirements

### Requirement: Atomic check-log appends
Check-log entries SHALL be appended atomically at the database level (jsonb concatenation in the UPDATE statement), never by writing back an array read earlier in the request. Concurrent checks on the same domain MUST NOT cause appended entries to be lost. The log SHALL remain capped at its maximum entry count, enforced in the same statement.

#### Scenario: Manual verify races the cron sweep
- **WHEN** a manual verify and a cron check of the same domain persist their outcomes concurrently
- **THEN** the check log contains both entries afterwards, in write order

#### Scenario: Log stays capped
- **WHEN** an append would push the log past the maximum entry count
- **THEN** the oldest entries are dropped in the same statement and the log length never exceeds the cap

### Requirement: Notifications only for persisted transitions
Verification notifications SHALL be emitted only when the state transition they announce was persisted. If the domain update affects no row (e.g. the domain was deleted mid-check), no events fire and no supersede sweep runs. Supersede notifications SHALL be emitted only for domains whose revoke update persisted. A check cycle that fails to persist MAY be lost silently; a notification for unpersisted state MUST NOT be sent.

#### Scenario: Domain deleted mid-check
- **WHEN** a check succeeds but the domain row no longer exists at write time
- **THEN** no "verified" notification is sent and no other domains are superseded

#### Scenario: Revoke update affects no row
- **WHEN** the supersede sweep's revoke update for another account's domain affects no row
- **THEN** that account receives no "superseded" notification
