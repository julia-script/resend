# ssr-detail-and-provider-guide — design

## Context

The working tree is mid-restructure. What already landed (keep): layout no longer gates auth; detail `page.tsx` is a server component with an ownership check (`getDomainById` + session compare + `notFound()` — the uniform-404 property is preserved); `UserMenu` is an async server component in a `Suspense`; `useDomain` accepts `initialData`; `Field`/`CopyButton`/`DnsGuide`/`CheckHistory` were extracted; `detectDnsProvider` exists with `"use cache"`.

What's broken or unfinished: no polling anywhere on the detail page; verify/remove buttons are commented-out JSX; `detectDnsProvider` is imported but never called; dead `DomainPage.tsx` still holds the entire old page; home (`await auth()` for a greeting, no redirect — the layout gate that used to protect it is gone) and signin (`await auth()` + redirect) read runtime IO outside Suspense, which `cacheComponents` treats as a blocking-route error; `detectprovider.ts` lacks `server-only`, queries the full domain name (subdomains return nothing), and substring-matches provider fingerprints.

## Goals / Non-Goals

**Goals:**
- Detail page: server-rendered shell, live islands; polling, verify, and remove all work again; `next build` passes with `cacheComponents: true`.
- Every protected page owns its session check (Next 16 guidance the owner is following: layouts don't re-run on navigation, so gates belong in pages/data).
- Provider detection wired into the guide with targeted hints for the top 4 providers; harmless fallback otherwise.
- Delete the debris.

**Non-Goals:**
- No API or state-machine changes; no new endpoints (detection stays a server-side call during render).
- No per-provider screenshots/instructions beyond the 4 curated ones.
- No `proxy.ts` auth gating — per-page checks are the chosen pattern; API routes remain the real enforcement layer (defense in depth already exists).

## Decisions

**1. Island layout on the detail page — three small client islands sharing one query.**

```
page.tsx (server)                        islands (client, shared queryKey)
┌───────────────────────────────┐
│ auth + getDomainById + detect │
│  <Suspense fallback=loading>  │
│   name (h1) ──────────────────┼── StatusHeader: badge, added/verified
│                               │     line, failure/grace/progress
│   DNS card                    │     banners, "last checked X ago"
│    Field name / Field value   │
│    DnsGuide provider={...}    │
│    ───────────────────────────┼── VerifyControls: button visibility
│                               │     (status-dependent), mutation, error
│   ────────────────────────────┼── RemoveButton: confirm + mutation
└───────────────────────────────┘
```

All three call `useDomain(id, initialData)` with the server-fetched domain. React Query dedupes identical keys, so there is exactly one poll loop; the existing `refetchInterval` logic (5s while `in_progress`/grace, off on terminal states) and the mutations' `setQueryData` mean verify-button results propagate to the badge and banners with no new wiring. This is the owner's "move polling to the components that use it" — the *data* stays one query; only the *rendering* is scoped.

*Alternative considered:* `router.refresh()` polling (pure-SSR). Rejected: re-renders the whole tree every 5s, re-runs detection, and abandons working mutation plumbing.

**2. Auth pattern: static shell + `<Suspense>` + per-page gate.**
Generalize the detail page's shape to home and signin: default export is a synchronous shell; an inner async component does `await auth()` (+ redirect for home when signed out, signin when signed in) inside the boundary. Home regains protection it silently lost. `UserMenu` keeps its own `auth()` read (it's already suspended) but renders nothing when signed out instead of redirecting — gates live in pages, not menus. Suspense fallbacks use existing loading strings/skeleton-grade markup, not blank.

**3. Detection hardening (module moves to `src/domain/detectprovider.ts`).**
- `import "server-only"` — this is the guard that would have caught the earlier client-import landmine at build time (module-boundaries pattern).
- Resolve NS/SOA on `tldts.getDomain(name)` (registrable domain); `mail.example.com` has no NS of its own.
- Fingerprint match on label boundary (`hostname === f || hostname.endsWith("." + f)`), keeping the `awsdns-` style infix entries as explicit prefix patterns — no more `evil-google.com.attacker.net` matches. Advisory-only either way, but correctness is the same line count.
- `cacheLife("days")` — NS records change on the order of provider migrations, not minutes.
- Keep: SOA fallback with `confidence`, catch-all → `Unknown`, which the UI treats as "render the generic guide".

**4. Provider hints are strings, not logic.**
`strings.ts` gains a `dnsProviders` map keyed by detected provider name for the curated 4 (Cloudflare, GoDaddy, Namecheap, AWS): one intro line ("Looks like your DNS is managed by …"), one name-field hint (relative for Cloudflare/GoDaddy/Namecheap, FQDN for Route 53), one dashboard URL. `DnsGuide` takes an optional `provider` prop; unknown/low-confidence → today's generic content untouched. Phrasing stays "looks like" — NS detection can be wrong (vanity nameservers), so it must never gate behavior.

**5. Check history → freshness line.**
`CheckHistory.tsx` deleted (owner call: debugging aid). The `StatusHeader` island shows "Last checked N minutes ago" from the tail of `checkLog` — the data is already in the polled response, and it preserves the "is anything happening?" signal that made history useful, at one line of UI. The salvageable pieces of `CheckHistory.tsx` (`timeAgo`, the `verifyActionKey` mirror) move into the islands that need them; unused history strings are removed.

## Risks / Trade-offs

- [Other routes may still violate the no-uncached-IO-outside-Suspense rule in ways dev mode hasn't surfaced] → `pnpm build` is an explicit verify task; it fails loudly per route and names the offender.
- [Serialized `initialData` shape (RSC-serialized Dates) vs. the zod-parsed API shape in the query cache could mismatch] → `useDomain` already wraps `{ data: initialData }`; verify types line up during apply and coerce at the boundary if not.
- [Detection adds an NS lookup to first page render] → cached for days after first hit; worst case ~tens of ms inside the existing Suspense boundary. Accepted.
- [Removing history loses a debugging aid the earlier UX review praised] → owner decision; freshness line + failure-reason banners keep the recovery story intact. Easy to restore from git if reviewers miss it.

## Open Questions

(none — owner has decided history removal and the per-page auth pattern.)
