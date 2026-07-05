# verification-feedback-ui

## Purpose
Domain detail page feedback: live polling, failure explanations, check history, and DNS guidance.

## Requirements

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

### Requirement: Last-check freshness indicator
The detail page SHALL show when the most recent check happened, in relative time, sourced from the latest check-log entry, updating as the page polls.

#### Scenario: Recent automatic check
- **WHEN** the cron checked the domain two minutes ago
- **THEN** the page shows the last check as roughly two minutes ago without a manual refresh

### Requirement: Ongoing-verification activity indicator
While a check outcome is pending — status `in_progress`, or `verified` with an active grace period — the detail page SHALL show a continuously animated activity indicator (e.g. a pulsing dot on the status badge or banner) tied to the domain's state, not to in-flight requests. The indicator MUST NOT flicker with the polling cycle and SHALL disappear on terminal or stable states.

#### Scenario: Verification in progress
- **WHEN** the owner views a domain that is `in_progress`
- **THEN** the status area shows a continuous pulsing indicator, steady between polls

#### Scenario: Verification completes
- **WHEN** the domain transitions to `verified` with no grace period
- **THEN** the activity indicator disappears within one polling interval

### Requirement: Beginner DNS guide
The detail page SHALL include a collapsible step-by-step guide for users who have never edited DNS, written in a friendly and lightly humorous tone, covering: where DNS is managed, finding the record editor, adding a TXT record with the shown name/value, and that propagation can take time.

#### Scenario: Non-technical user opens the guide
- **WHEN** the user expands the DNS help section
- **THEN** they see numbered plain-language steps referencing the exact record name and value shown on the page, with no unexplained jargon

### Requirement: Provider-aware DNS guidance
When the domain's DNS provider can be detected from its nameservers (or SOA as a fallback), the DNS guide SHALL show the detected provider by name with hedged phrasing ("Looks like…") and the provider's logo, rendered from an asset bundled with the app (no external image requests). For every fingerprinted provider, the guide SHALL link to the provider's official documentation article on creating DNS/TXT records, and SHALL link to the provider's DNS management page — using the most direct deep link the provider supports (e.g. Cloudflare's `dash.cloudflare.com/?to=/:account/:zone/dns/records`) and falling back to the provider's dashboard or homepage when no deeper link exists. Providers with a curated record-name hint (relative label vs. fully-qualified name) SHALL continue to show it. Detection SHALL be advisory only: when the provider is unknown, low-confidence, or detection fails, the generic guide renders unchanged — no provider name, logo, or links — and the page MUST NOT error or block on detection.

#### Scenario: Cloudflare-hosted domain
- **WHEN** the owner views a domain whose nameservers match Cloudflare
- **THEN** the guide shows the Cloudflare logo and name, tells the user to enter the relative record name, links to Cloudflare's create-DNS-records article, and links to the DNS records deep link (`https://dash.cloudflare.com/?to=/:account/:zone/dns/records`)

#### Scenario: Fingerprinted provider without a deep link
- **WHEN** the owner views a domain whose nameservers match a fingerprinted provider that has no zone-level deep link
- **THEN** the guide shows that provider's logo, name, and official article link, and the DNS page link points to the provider's dashboard or DNS product page instead

#### Scenario: Unknown nameservers
- **WHEN** detection returns no known provider or the DNS lookup fails
- **THEN** the generic step-by-step guide renders exactly as before, with no provider name, logo, or links

#### Scenario: External links open safely
- **WHEN** the user clicks the article link or the DNS page link
- **THEN** the link opens in a new tab with `rel="noreferrer"`
