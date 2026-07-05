# module-boundaries

## ADDED Requirements

### Requirement: Server-only modules fail the client build
Modules that touch the database, environment secrets, Node APIs, or email sending SHALL declare themselves server-only, so that importing them (directly or transitively) from a client component fails at build time rather than at runtime.

#### Scenario: Accidental client import
- **WHEN** a `"use client"` component imports a module that transitively reaches `db/client` or `lib/env`
- **THEN** `next build` (and the dev compiler) reports a server-only import error instead of the browser crashing on a missing Node API

### Requirement: Shared contract stays isomorphic
The shared domain contract module (status enum values, `PartialDomainSchema`, `CheckLogEntrySchema`, and their inferred types) SHALL remain importable from both server and client code and SHALL NOT import any server-only module.

#### Scenario: Client component uses the contract
- **WHEN** a client component imports the shared contract for schema validation and types
- **THEN** the bundle builds and runs without pulling in database, env, or Node dependencies
