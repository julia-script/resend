# accessible-feedback

## Purpose
Accessibility of forms, dynamic feedback, and error states across the app.

## Requirements

### Requirement: Labeled inputs
Every user-facing form input SHALL have a programmatically associated label (`<label htmlFor>` / `id`, matching the pattern already used in the dev mocks console). This covers the sign-in email input and the domain-create name input.

#### Scenario: Screen reader on the sign-in form
- **WHEN** assistive technology focuses the sign-in email input
- **THEN** it announces a meaningful label, not just a placeholder

### Requirement: Announced feedback
Dynamic feedback SHALL be exposed to assistive technology: form errors and the claim-conflict warning use `role="alert"` (or `aria-live="assertive"`), and the copy button's "Copied" confirmation lives in an `aria-live="polite"` region.

#### Scenario: Create form error
- **WHEN** a domain create fails and an error message renders
- **THEN** the message is announced without the user having to move focus

#### Scenario: Copying a DNS record
- **WHEN** the user activates the copy button and the label flips to "Copied"
- **THEN** the change is announced politely

### Requirement: Delete failures are surfaced
A failed domain deletion SHALL show the user a visible, announced error message. Silent failure is not acceptable.

#### Scenario: Delete request fails
- **WHEN** the DELETE request errors after the user confirms removal
- **THEN** the detail page shows an error message (announced via the live region) and the user stays on the page

### Requirement: Branded 404 page
The app SHALL define a root `not-found.tsx` so that `notFound()` calls and unknown routes render a branded 404 page with a link back to the domain list, instead of Next's default.

#### Scenario: Foreign domain id
- **WHEN** a signed-in user opens another account's domain detail URL
- **THEN** the branded 404 page renders with navigation back into the app
