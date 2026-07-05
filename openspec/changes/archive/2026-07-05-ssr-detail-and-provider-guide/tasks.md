# ssr-detail-and-provider-guide — tasks

## 1. Detection module hardening

- [x] 1.1 Move src/lib/detectprovider.ts to src/domain/detectprovider.ts; add `import "server-only"`, resolve NS/SOA on `tldts.getDomain(name)`, switch fingerprints to label-boundary matching (keeping `awsdns-` as an explicit prefix pattern), add `cacheLife("days")`
- [x] 1.2 Drop dubious fingerprints (e.g. Shopify — shops don't run NS there) and keep the map honest; empty catches become explicit `// advisory: fall through` comments

## 2. Detail page islands

- [x] 2.1 Create StatusHeader island (badge, added/verified meta, failure/grace/in-progress banners, "last checked X ago") using `useDomain(id, initialData)`; move `timeAgo` here from CheckHistory
- [x] 2.1b Add a pulsing activity dot (Tailwind `animate-pulse`) to the status badge/banner while `in_progress` or in active grace — driven by domain status, not fetch state; gone on terminal/stable states
- [x] 2.2 Create VerifyControls island (status-dependent visibility, verify mutation, pending/error states); move the `verifyActionKey` mirror here
- [x] 2.3 Create RemoveButton island (confirm + delete mutation + redirect to list)
- [x] 2.4 Rewrite page.tsx: server shell + Suspense with a loading fallback, session + ownership check kept, `detectDnsProvider` actually called, provider passed to DnsGuide, islands mounted, double `<main>` and all commented-out JSX removed
- [x] 2.5 Delete DomainPage.tsx and CheckHistory.tsx; remove now-unused strings and imports; verify `initialData` type lines up with the query cache shape

## 3. Provider-aware guide

- [x] 3.1 Add `dnsProviders` strings (intro line, name-field hint, dashboard URL) for Cloudflare, GoDaddy, Namecheap, AWS Route 53 in src/lib/strings.ts
- [x] 3.2 DnsGuide accepts optional `provider` prop: provider line + targeted name-field hint when known, generic guide otherwise

## 4. Auth placement and Suspense hygiene

- [x] 4.1 Home page: static shell + Suspense'd async content; `redirect("/signin")` when signed out (restores the protection lost with the layout gate)
- [x] 4.2 Signin page: same shell pattern for its `auth()` + signed-in redirect
- [x] 4.3 UserMenu: stop redirecting; render nothing when signed out; drop unused auth/redirect imports left in layout.tsx; remove stray blank line in next.config.ts

## 5. Verify

- [x] 5.1 `pnpm build` passes (proves no route reads uncached IO outside Suspense), `pnpm test` and `pnpm lint` pass
- [x] 5.2 In preview: signed-out visit to / and /domains/[id] redirects to signin; detail page polls (status flips without refresh), verify and remove buttons work, provider line renders for a Cloudflare-hosted domain and generic guide for an unknown one
