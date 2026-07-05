# Enrich DNS provider guides with article links, deep links, and logos

## Why

We already detect a domain's DNS provider (`detectDnsProvider`) and show a curated hint plus a dashboard link for 4 of the 13 fingerprinted providers. But the guide still makes users hunt: the dashboard links land on generic homepages (not the DNS records page), there is no pointer to the provider's own official how-to article, and there is no visual confirmation ("yes, this is my provider") that a logo gives at a glance. Users who are least comfortable with DNS get the least help exactly where a provider-specific shortcut would matter most.

## What Changes

- Extend the per-provider metadata to cover **all fingerprinted providers** (Cloudflare, AWS, Google, Azure, DigitalOcean, Namecheap, GoDaddy, Bluehost, HostGator, DreamHost, Squarespace, Wix, Vercel), each with:
  - **Guide article URL** — the provider's official "create a DNS/TXT record" documentation (e.g. Cloudflare: `https://developers.cloudflare.com/dns/manage-dns-records/how-to/create-dns-records/`).
  - **DNS page deep link** — the most direct link to where records are edited (e.g. Cloudflare: `https://dash.cloudflare.com/?to=/:account/:zone/dns/records`, which resolves the user's own account/zone). Falls back to the dashboard/homepage when no deeper link exists.
  - **Logo** — a small brand mark bundled with the app (no external image requests).
- `DnsGuide` renders the enriched block when a provider is detected: logo + provider name, a prominent "open your DNS records" link, and a "how to add a TXT record on <provider>" article link. Existing `nameHint` behavior is preserved.
- Detection itself (`detectDnsProvider`) stays advisory and unchanged in behavior: unknown/low-confidence still renders the generic guide with no provider block and never errors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `verification-feedback-ui`: the "Provider-aware DNS guidance" requirement grows from "name + name-field hint + dashboard link for 4 curated providers" to "logo, official guide article link, and DNS-page deep link for every fingerprinted provider", with the same advisory fallback behavior.

## Impact

- `src/lib/strings.ts` — the `dnsProviders.guide` map becomes the single per-provider metadata record (nameHint, guide article URL, DNS page URL, logo reference) covering all 13 providers.
- `src/app/(protected)/domains/[id]/DnsGuide.tsx` — renders logo, article link, and deep link.
- `public/` — new bundled logo assets (SVG), one per provider.
- `src/domain/detectprovider.ts` — no behavioral change; remains the source of provider names that key the metadata map.
- No API, schema, or dependency changes expected (logos bundled as static assets).
