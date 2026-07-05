# Design: enrich-dns-provider-guides

## Context

`detectDnsProvider` (src/domain/detectprovider.ts) fingerprints 13 providers from NS/SOA records and returns a provider *name*. `DnsGuide` (server-rendered) looks that name up in `strings.dnsProviders.guide`, which today holds `nameHint` + `dashboard` for only 4 providers. The guide block is advisory: unknown/low-confidence renders the generic steps.

Constraints:
- `strings.ts` is imported by client components; it must stay free of server-only imports (so it cannot import types from `detectprovider.ts`, which pulls in `node:dns`).
- The existing spec requires detection to stay advisory and never block or error the page.
- Project style: no new dependencies when a few files do the job.

## Goals / Non-Goals

**Goals:**
- Every fingerprinted provider gets: official "create a DNS record" article URL, the most direct DNS-page link available, and a bundled logo.
- `DnsGuide` displays logo, article link, and DNS-page link; keeps the existing nameHint behavior.

**Non-Goals:**
- No changes to detection (fingerprints, confidence, caching).
- No per-provider step-by-step rewrites — links point at the provider's own docs instead.
- No external image/favicon services; no new npm dependencies.

## Decisions

1. **Metadata stays in `strings.dnsProviders.guide`, widened to all 13 providers.**
   The dashboard links already live there; this extends the existing record to
   `{ nameHint?, article, dnsPage, logo }` keyed by the provider names `detectprovider.ts` emits.
   `nameHint` becomes optional (we only have curated hints for 4 providers).
   *Alternative considered*: a new `src/lib/providers.ts` module — rejected; it splits one lookup across two files and the map is small.
   Key drift between the two files is caught by a unit test (see Risks).

2. **Logos are small SVGs committed under `public/providers/<slug>.svg`, rendered with a plain `<img>` at ~20px.**
   *Alternatives considered*: `simple-icons` package (new dependency, and AWS/others have been removed from it for legal reasons); favicon proxy services (external requests, flaky, privacy). Bundled assets are boring, offline-safe, and cacheable. Logo use is nominative (identifying the user's own provider) — standard practice.

3. **`dnsPage` is "the deepest link that works for everyone".**
   Cloudflare supports a zone-resolving redirect (`https://dash.cloudflare.com/?to=/:account/:zone/dns/records`). Most providers only offer a domain-list or DNS-product page; for those, `dnsPage` is that page. No attempt to template the user's own domain into URLs (we don't know their provider account structure). Starter table (verify each during implementation):

   | Provider | Article | DNS page |
   |---|---|---|
   | Cloudflare | developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/ | dash.cloudflare.com/?to=/:account/:zone/dns/records |
   | AWS | Route 53 "creating records" docs | console.aws.amazon.com/route53/v2/hostedzones |
   | GoDaddy | godaddy.com help "Add a TXT record" | dcc.godaddy.com/domains |
   | Namecheap | namecheap.com support "How do I add TXT…" | ap.www.namecheap.com/domains/list/ |
   | Google | Cloud DNS "Add, modify, and delete records" | console.cloud.google.com/net-services/dns/zones |
   | Azure | learn.microsoft.com DNS "manage records" | portal.azure.com (DNS zones blade) |
   | DigitalOcean / Vercel / Squarespace / Wix / Bluehost / HostGator / DreamHost | each provider's official TXT-record article | each provider's domain/DNS console page |

4. **`DnsGuide` layout**: the existing intro paragraph becomes a small header row — logo + "Looks like your DNS is managed by X" — followed by two links: "Open your DNS records ↗" (`dnsPage`) and "How to add a TXT record on X ↗" (`article`). Both `target="_blank" rel="noreferrer"` (spec scenario). The numbered generic steps stay below, unchanged.

## Risks / Trade-offs

- [Provider renames a doc URL or dashboard path → dead link] → Links are advisory extras, not load-bearing; worst case the user lands on the provider's docs home. No runtime checking.
- [Metadata map keys drift from `PROVIDERS` keys in detectprovider.ts] → One unit test asserts every fingerprinted provider name has a metadata entry (import direction: test imports both; strings.ts itself never imports server code).
- [Google Domains is defunct (sold to Squarespace)] → The `googledomains.com` fingerprint still exists for legacy zones; point Google's entry at Cloud DNS docs/console, which is where remaining Google-hosted zones live.
- [Logo SVGs vary in aspect ratio] → Fixed square viewport (object-fit: contain) at render; keep assets monochrome-or-official small marks.

## Migration Plan

Pure additive UI change: ship it. Rollback = revert commit. No data, schema, or API impact.

## Open Questions

None blocking — exact URLs for the long-tail providers are resolved during implementation (task includes verifying each link returns 200 and points at the current doc).
