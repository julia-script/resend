# ssr-detail-and-provider-guide

## Why

The detail page was restructured to server-render under `cacheComponents` and to detect the user's DNS provider, but the restructure is half-landed: live polling is gone (the page still promises "this page updates itself"), the verify and remove buttons are commented out, provider detection is imported but never used, a dead copy of the old client page remains, and the home/signin pages still read `auth()` outside a Suspense boundary — the same blocking-route violation just fixed in the layout. This change finishes the restructure, cleans up the debris, and ships the provider-aware DNS guidance the detection was built for.

## What Changes

- Detail page becomes cleanly hybrid: server component owns auth + domain fetch + static content (record fields, guide); small client islands own everything live — status header (badge, meta, banners), verify controls, remove button — all sharing one `useDomain(id, initialData)` query so polling resumes and mutations update the UI. Interactive buttons return.
- Auth checks move to where they're used, per Next 16 guidance: each protected page gates its own session (detail page already does; home page regains its signed-out redirect, lost when the layout gate was removed). `UserMenu` stops redirecting — a menu is not an auth gate. Home and signin adopt the same static-shell + `<Suspense>` pattern as the detail page so no route reads uncached IO outside a boundary.
- Provider detection gets wired and hardened: `server-only` guard, NS lookup on the registrable domain (subdomains resolve nothing today), label-boundary suffix matching, `cacheLife`, and the module moves to `src/domain/` alongside the other DNS logic. `DnsGuide` renders "Looks like your DNS is managed by X" plus targeted hints (relative vs. fully-qualified name field, dashboard link) for Cloudflare, GoDaddy, Namecheap, and Route 53 — generic guide otherwise, and on detection failure nothing changes.
- While a check outcome is pending (`in_progress`, or verified with active grace), the status area shows a continuous pulsing activity indicator — tied to domain state, not in-flight requests, so it doesn't flicker with the 5s poll cycle.
- **BREAKING (UI)**: Check history list is removed (owner decision: it was a debugging aid). A one-line "Last checked X ago" freshness indicator in the status island keeps the process observable.
- Cleanup: delete dead `DomainPage.tsx`, commented-out JSX blocks, double `<main>` nesting, unused imports, stray config whitespace; Suspense boundaries get loading fallbacks instead of blank flashes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `verification-feedback-ui`: REMOVED "Check history display"; ADDED "Provider-aware DNS guidance" and "Last-check freshness indicator". Live status polling requirement is unchanged in behavior (implementation moves from whole-page client fetch to scoped islands sharing one query).

## Impact

- `src/app/(protected)/domains/[id]/` — page.tsx finished; new island components; `DomainPage.tsx` and `CheckHistory.tsx` deleted; `Field`/`CopyButton`/`DnsGuide` kept.
- `src/app/(protected)/page.tsx`, `src/app/signin/page.tsx`, `src/app/(protected)/layout.tsx`, `src/components/auth/UserMenu.tsx` — auth placement + Suspense pattern.
- `src/lib/detectprovider.ts` → `src/domain/` (hardened); `src/lib/strings.ts` gains provider strings.
- `src/hooks/domains.ts` — `initialData` support (already sketched by owner) kept.
- No API, schema, or state-machine changes. `next build` becomes the gate that proves no route blocks on uncached IO.
