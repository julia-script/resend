## ADDED Requirements

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
