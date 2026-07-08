# test-hygiene

## Purpose
Hermetic, environment-tolerant test suite that passes on a fresh clone.

## Requirements

### Requirement: Hermetic DKIM tests
DKIM verification tests SHALL use the existing mock-DNS injection point (`mockRecord` on `checkDkim`) instead of resolving live DNS. The suite MUST NOT depend on TXT records of any third-party domain.

#### Scenario: DKIM tests offline
- **WHEN** the DKIM tests run with no network access
- **THEN** they pass, exercising found / missing / malformed record paths through injected mock responses

### Requirement: Database tests gated on environment
Tests that require a live Postgres SHALL be skipped automatically (not failed) when `DATABASE_URL` is not set, and the skip SHALL be visible in the test output.

#### Scenario: Fresh clone without a database
- **WHEN** `pnpm test` runs without `DATABASE_URL`
- **THEN** the DB integration tests report as skipped and the run exits green

#### Scenario: Database available
- **WHEN** `DATABASE_URL` points at a reachable Postgres
- **THEN** the DB integration tests run and assert against it

### Requirement: Fresh-clone test run passes
`pnpm test` on a fresh clone SHALL pass without a `.env` file. Test configuration SHALL tolerate a missing `.env`, and any env vars that unlock additional tests SHALL be documented in the README and `.env.example`.

#### Scenario: No .env present
- **WHEN** `pnpm test` runs in a clean checkout with no `.env`
- **THEN** the run completes green (env-dependent tests skipped or fed test defaults) instead of crashing on env loading or validation
