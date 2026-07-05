# Tasks: enrich-dns-provider-guides

## 1. Provider metadata

- [x] 1.1 Research and verify, for each of the 13 fingerprinted providers, the official "create a DNS/TXT record" article URL and the most direct DNS-page link (Cloudflare uses `https://dash.cloudflare.com/?to=/:account/:zone/dns/records`; others fall back to their domain/DNS console page). Record the verified URLs in the metadata map.
- [x] 1.2 Widen `strings.dnsProviders.guide` to `{ nameHint?, article, dnsPage, logo }` entries for all 13 providers, keeping the 4 existing nameHints; update the record's TypeScript type accordingly.
- [x] 1.3 Collect small official SVG marks for the 13 providers into `public/providers/<slug>.svg` (square-ish, small file size, no scripts/external refs inside the SVGs).

## 2. Guide UI

- [x] 2.1 Update `DnsGuide.tsx`: header row with logo (`<img>`, ~20px, contained) + "Looks like your DNS is managed by X"; links "Open your DNS records ↗" (`dnsPage`) and "How to add a TXT record on X ↗" (`article`), both `target="_blank" rel="noreferrer"`; keep nameHint substitution in the numbered steps.
- [x] 2.2 Preserve the advisory fallback: unknown/low-confidence provider renders the generic guide with no provider block (no logo, no links), and a detected provider missing from the metadata map degrades to name-only rather than crashing.

## 3. Verification

- [x] 3.1 Unit test: every provider name in `detectprovider.ts`'s `PROVIDERS` has a metadata entry in `strings.dnsProviders.guide`, and every entry's `logo` file exists in `public/providers/`.
- [x] 3.2 Manual/preview check on a domain detail page: Cloudflare-detected domain shows logo, article link, and the zone deep link; an unknown-NS domain shows the unchanged generic guide. (Verified via server-rendered markup assertions in DnsGuide.test.tsx — the app's magic-link auth blocks headless browser access; logos confirmed served at /providers/*.svg with the dev server error-free.)
- [x] 3.3 Run `biome check` and `tsc --noEmit`; fix anything they flag.
