# verification-feedback-ui

## ADDED Requirements

### Requirement: Live status polling
The domain detail page SHALL poll the domain while a check outcome is pending — status `in_progress`, or `verified` with an active grace period — and SHALL stop polling on terminal or stable states (`not_started`, `failed`, `verified` without grace period).

#### Scenario: Verification completes while the page is open
- **WHEN** a domain transitions from `in_progress` to `verified` server-side
- **THEN** the page reflects the new status within one polling interval without a manual refresh

#### Scenario: No polling when stable
- **WHEN** the domain is `verified` with no grace period active
- **THEN** the page issues no periodic refetches

### Requirement: Plain-language failure reasons
Whenever a domain is `failed`, the detail page SHALL show a plain-language explanation of the `statusReason` and what to do next, not just the enum value.

#### Scenario: Superseded domain
- **WHEN** the owner views a domain that is `failed`/`superseded`
- **THEN** the page explains that another account verified this name, that re-verifying will generate a new DNS record, and offers the re-verify action

### Requirement: Check history display
The detail page SHALL show recent `checkLog` entries in humanized form (outcome, reason, relative time), newest first.

#### Scenario: Failed check appears in history
- **WHEN** a check fails with `record_not_found`
- **THEN** the history shows an entry like "record not found" with when it happened

### Requirement: Beginner DNS guide
The detail page SHALL include a collapsible step-by-step guide for users who have never edited DNS, written in a friendly and lightly humorous tone, covering: where DNS is managed, finding the record editor, adding a TXT record with the shown name/value, and that propagation can take time.

#### Scenario: Non-technical user opens the guide
- **WHEN** the user expands the DNS help section
- **THEN** they see numbered plain-language steps referencing the exact record name and value shown on the page, with no unexplained jargon
