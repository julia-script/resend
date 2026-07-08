# domain-management

## Purpose
Creating, claiming, and deleting domains, including conflict handling between accounts.

## Requirements

### Requirement: Claim conflict warning
`POST /api/domains` for a name already verified by another account SHALL return `409` with code `domains/name_taken` when `enforce` is false, and SHALL create the domain for the requesting user when `enforce` is true.

#### Scenario: First attempt without enforce
- **WHEN** a user creates a domain name another account has verified, with `enforce: false`
- **THEN** the API responds 409 `domains/name_taken` and creates nothing

#### Scenario: Confirmed claim
- **WHEN** the same request is repeated with `enforce: true`
- **THEN** a new domain row is created for the requesting user in `not_started`, and the existing owner's domain is untouched until the claimant actually verifies

### Requirement: Claim confirmation UI
The create form SHALL surface the 409 as a confirmation prompt explaining that verifying will revoke the current owner, and only resubmit with `enforce: true` after explicit user confirmation.

#### Scenario: User confirms a claim
- **WHEN** the create form receives `domains/name_taken`
- **THEN** it shows the takeover warning with a confirm action, and only after the user confirms does it resubmit with `enforce: true`

### Requirement: Domain deletion
`DELETE /api/domains/{id}` SHALL permanently delete the caller's domain. Ownership rules match the other domain routes (foreign/unknown ids are 404). The detail page SHALL offer removal behind a confirmation.

#### Scenario: Owner deletes a domain
- **WHEN** the owner confirms removal on the detail page
- **THEN** the domain row is deleted, the user is returned to the domain list, and the list no longer contains the domain

#### Scenario: Deleting someone else's domain
- **WHEN** a signed-in user calls DELETE with another account's domain id
- **THEN** the API responds 404 and deletes nothing

### Requirement: Concurrent duplicate create is idempotent
`POST /api/domains` SHALL catch the database unique-constraint violation on `(userId, name)`, re-fetch the caller's existing row, and return it with `200` — matching the sequential duplicate path, which already returns the existing domain. A duplicate create MUST NOT surface as a `500`.

#### Scenario: Double-submitted create form
- **WHEN** two identical create requests for the same user and domain name insert concurrently and the second hits the unique constraint
- **THEN** both requests receive 200 with the same domain, and exactly one domain row exists

### Requirement: Delete failures are visible
A failed `DELETE /api/domains/{id}` SHALL surface as a visible error on the detail page rather than failing silently (see `accessible-feedback` for the announcement requirements).

#### Scenario: Backend delete error
- **WHEN** the delete request returns an error after the user confirms removal
- **THEN** the page shows an error message and the domain remains listed

### Requirement: IDN normalization to punycode
Unicode (internationalized) domain names SHALL be normalized to their punycode ASCII form on create, so the stored name, the DNS record instructions shown to the user, and DNS lookups all use the form DNS actually resolves. Already-ASCII and already-punycoded inputs SHALL pass through unchanged (modulo lowercasing and trailing-dot stripping).

#### Scenario: Unicode domain name
- **WHEN** a user creates the domain `münchen.de`
- **THEN** the domain is stored and displayed as `xn--mnchen-3ya.de` and DKIM checks query the punycoded name

#### Scenario: Already-punycoded input
- **WHEN** a user creates the domain `xn--mnchen-3ya.de`
- **THEN** the name is stored unchanged
