# domain-verification-lifecycle

## ADDED Requirements

### Requirement: Starting verification
`POST /api/domains/{id}/verify` on a `not_started` domain SHALL move it to `in_progress`, set `nextCheckAt` to now and `deadlineAt` to now + the verification window, and run one DKIM check immediately.

#### Scenario: First verify
- **WHEN** the owner posts to `/verify` for a `not_started` domain
- **THEN** the domain becomes `in_progress` with a deadline, one check runs immediately, and the response contains the post-check domain state

### Requirement: Restart after recoverable failure
A `failed` domain with `statusReason` of `expired` or `grace_period_expired` SHALL be restartable via the same `/verify` endpoint, keeping its existing selector and DKIM keys.

#### Scenario: Restart expired verification
- **WHEN** the owner posts to `/verify` for a domain that is `failed`/`expired`
- **THEN** the domain returns to `in_progress` with a fresh deadline and its selector and public key are unchanged

### Requirement: Key rotation after supersede
A `failed` domain with `statusReason: superseded` SHALL require key rotation on restart: `/verify` generates a new selector and keypair, persists them, and then restarts verification. The old DNS record MUST NOT be able to verify the domain again.

#### Scenario: Re-claiming a superseded domain
- **WHEN** the owner posts to `/verify` for a domain that is `failed`/`superseded`
- **THEN** the domain gets a new selector and public key, returns to `in_progress`, and the response reflects the new DNS record the user must add

### Requirement: Manual check throttle
Manual verify requests on an active (`in_progress` or `verified`) domain SHALL run an immediate DKIM check only if the last recorded check is older than the throttle interval; otherwise the endpoint returns current state without checking.

#### Scenario: Spamming the verify button
- **WHEN** the owner posts to `/verify` twice within the throttle interval
- **THEN** the second request performs no DNS lookup and returns the current domain state

### Requirement: Configurable timings
Recheck intervals, grace period, warning delay, verification window, and notification sender SHALL be configurable via environment variables, defaulting to the current hardcoded values when unset.

#### Scenario: Default behavior without env vars
- **WHEN** none of the timing env vars are set
- **THEN** behavior is identical to the current constants (1 min pending recheck, 1 day success recheck, 1 day grace, 1 h warning delay, 2 day window)
