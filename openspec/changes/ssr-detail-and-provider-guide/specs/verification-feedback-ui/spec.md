# verification-feedback-ui — delta

## ADDED Requirements

### Requirement: Provider-aware DNS guidance
When the domain's DNS provider can be detected from its nameservers (or SOA as a fallback), the DNS guide SHALL show the detected provider by name with hedged phrasing ("Looks like…"), a provider-specific hint for the record name field (relative label vs. fully-qualified name), and a link to the provider's DNS dashboard for curated providers (Cloudflare, GoDaddy, Namecheap, AWS Route 53). Detection SHALL be advisory only: when the provider is unknown, low-confidence, or detection fails, the generic guide renders unchanged and the page MUST NOT error or block on detection.

#### Scenario: Cloudflare-hosted domain
- **WHEN** the owner views a domain whose nameservers match Cloudflare
- **THEN** the guide says the DNS looks like it is managed by Cloudflare, tells the user to enter the relative record name, and links to the Cloudflare dashboard

#### Scenario: Unknown nameservers
- **WHEN** detection returns no known provider or the DNS lookup fails
- **THEN** the generic step-by-step guide renders exactly as before, with no provider line

### Requirement: Ongoing-verification activity indicator
While a check outcome is pending — status `in_progress`, or `verified` with an active grace period — the detail page SHALL show a continuously animated activity indicator (e.g. a pulsing dot on the status badge or banner) tied to the domain's state, not to in-flight requests. The indicator MUST NOT flicker with the polling cycle and SHALL disappear on terminal or stable states.

#### Scenario: Verification in progress
- **WHEN** the owner views a domain that is `in_progress`
- **THEN** the status area shows a continuous pulsing indicator, steady between polls

#### Scenario: Verification completes
- **WHEN** the domain transitions to `verified` with no grace period
- **THEN** the activity indicator disappears within one polling interval

### Requirement: Last-check freshness indicator
The detail page SHALL show when the most recent check happened, in relative time, sourced from the latest check-log entry, updating as the page polls.

#### Scenario: Recent automatic check
- **WHEN** the cron checked the domain two minutes ago
- **THEN** the page shows the last check as roughly two minutes ago without a manual refresh

## REMOVED Requirements

### Requirement: Check history display
**Reason**: The full check-history list was a development debugging aid; the failure-reason banners plus the new last-check freshness indicator carry the user-facing signal at a fraction of the surface.
**Migration**: No data change — `checkLog` is still recorded and returned by the API; only the list UI is removed. Restorable from git history if needed.
