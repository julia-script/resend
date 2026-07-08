# mock-console-gating

## Purpose
Gating the mock DNS/email console so it is never reachable in production.

## Requirements

### Requirement: Mock console hard-blocked in production
The mock DNS/email console (page, server actions, and any nav links) SHALL be unreachable when `NODE_ENV === "production"`, regardless of the `ENABLE_MOCK` env var. The env var only enables mocks in non-production environments.

#### Scenario: ENABLE_MOCK leaks into a production deploy
- **WHEN** a production build runs with `ENABLE_MOCK=true`
- **THEN** the mocks page 404s, mock server actions reject, no mocks nav link renders, and DKIM checks ignore mock records

#### Scenario: Local development
- **WHEN** a dev server runs with `ENABLE_MOCK=true`
- **THEN** the mock console works as today
