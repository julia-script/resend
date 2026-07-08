# Inkwell

A domain ownership checker: claim a domain, prove you own it through a real
DKIM TXT record, and keep it verified over time. Built as a take-home for
Resend's Product Engineer role.

The full write-up lives in the app itself: **`/docs/postmortem`** has the
documentation, the post-mortem (why I chose what I chose, what I'd do
differently), and interactive state diagrams for every flow.

## What it does

- Claim a domain and get a generated DKIM key pair with copy-paste DNS
  instructions, including detected-provider guides and deep links
- Verify ownership by resolving the real TXT record and comparing keys
- Keep monitoring verified domains: a disappearing record starts a 24h grace
  period with a warning email instead of instant revocation
- Handle ownership transfers: taking over an already-verified domain requires
  an explicit confirmation, rotates keys so the old record can never validate
  again, and notifies the previous owner
- Email notifications (verification results, grace period, supersede) sent
  through Resend
- Public-style REST API with an OpenAPI reference at `/api/reference`

## Stack

Next.js + React, Hono + zod-openapi for the API, Drizzle + Postgres, Auth.js
with Resend magic links, TanStack Query, Tailwind, Biome, Vitest. Deployed on
Vercel with a cron sweep for background checks.

## Running locally

Prerequisites: Node 20+, pnpm, Docker.

```bash
pnpm install
docker compose up -d        # Postgres on :5432
cp .env.example .env        # then fill in the values below
pnpm db:migrate
pnpm dev
```

In a second terminal, run the local stand-in for the Vercel cron (hits
`/api/cron/verify` once a minute):

```bash
pnpm cron:dev
```

### Environment variables

Required:

| Variable          | What it is                                          |
| ----------------- | --------------------------------------------------- |
| `DATABASE_URL`    | `postgres://postgres:postgres@localhost:5432/resend` for the compose setup |
| `AUTH_SECRET`     | Auth.js session secret (`openssl rand -base64 32`)  |
| `AUTH_RESEND_KEY` | Resend API key, used for magic links and notifications |
| `ENCRYPTION_KEY`  | 32-byte hex (`openssl rand -hex 32`), encrypts DKIM private keys at rest |
| `CRON_SECRET`     | Bearer token the cron endpoint requires             |

Optional:

| Variable                  | Default | What it tunes                        |
| ------------------------- | ------- | ------------------------------------ |
| `PENDING_RECHECK_MS`      | 1m      | Recheck interval while in progress   |
| `SUCCESS_RECHECK_MS`      | 24h     | Recheck interval once verified       |
| `GRACE_PERIOD_MS`         | 24h     | Grace period before revocation       |
| `GRACE_PERIOD_WARNING_MS` | 1h      | When the grace period warning sends  |
| `VERIFICATION_WINDOW_MS`  | 48h     | How long a verification attempt lives |
| `NOTIFICATIONS_FROM`      |         | From address for notification emails |
| `ENABLE_MOCK`             | off     | Enables the mock DNS console at `/mocks`. Never set in production |

### Mock DNS console

Real DNS propagation is slow, so with `ENABLE_MOCK=true` the app serves a
console at `/mocks` where mock domains can be pointed at any DNS answer:
a correct record, a wrong key, `ENODATA`, `ENOTFOUND`, or any other error
code. This is how every state transition can be exercised without owning a
pile of domains.

## Tests

```bash
pnpm test
```

The verification state machine (`src/domain/verification.ts`) is a pure
function with tests around every transition, plus tests for DKIM checking,
notifications, and the DB helpers.

The suite is hermetic: it runs green on a fresh clone with no `.env` and no
network (DNS answers are injected through the same mock seam the dev console
uses). The Postgres integration tests skip themselves unless `DATABASE_URL`
is set — point it at the docker-compose database to include them.

## Project layout

```
src/
  app/            Next.js routes (UI, API mount, docs)
  components/     Shared UI
  db/             Drizzle schema and queries
  domain/         The core: verification state machine, DKIM, DNS, notifications
  lib/api/        Hono routes (domains, cron) and OpenAPI setup
  shared/         Types and schemas safe for client and server
openspec/         Spec-first change history (proposals, specs, archived changes)
drizzle/          Generated migrations
```

The `openspec/` folder is part of the story: features were planned as specs
before implementation, and the archived changes document what was built and
why.
