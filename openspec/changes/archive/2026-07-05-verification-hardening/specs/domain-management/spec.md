# domain-management — delta

## ADDED Requirements

### Requirement: IDN normalization to punycode
Unicode (internationalized) domain names SHALL be normalized to their punycode ASCII form on create, so the stored name, the DNS record instructions shown to the user, and DNS lookups all use the form DNS actually resolves. Already-ASCII and already-punycoded inputs SHALL pass through unchanged (modulo lowercasing and trailing-dot stripping).

#### Scenario: Unicode domain name
- **WHEN** a user creates the domain `münchen.de`
- **THEN** the domain is stored and displayed as `xn--mnchen-3ya.de` and DKIM checks query the punycoded name

#### Scenario: Already-punycoded input
- **WHEN** a user creates the domain `xn--mnchen-3ya.de`
- **THEN** the name is stored unchanged
