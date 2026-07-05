# Delta: verification-feedback-ui

## MODIFIED Requirements

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
