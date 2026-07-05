# cron-verification-sweep

## ADDED Requirements

### Requirement: Scheduled sweep
The project SHALL ship a `vercel.json` scheduling `GET /api/cron/verify` every minute, authenticated with `Authorization: Bearer <CRON_SECRET>` (Vercel cron convention).

#### Scenario: Deployed cron tick
- **WHEN** Vercel invokes the cron endpoint with the correct secret
- **THEN** all due domains (`in_progress` with `nextCheckAt` in the past) are checked and the response reports how many

### Requirement: Per-domain error isolation
One domain's check failing with a thrown error SHALL NOT abort the sweep, block other domains' checks, or drop other domains' notifications. Failures are logged and reported in the response.

#### Scenario: One domain's DB write fails
- **WHEN** a sweep of 10 domains has one `updateDomain` throw
- **THEN** the other 9 domains complete, their notifications are still batched and sent, the failure is logged, and the endpoint still returns 200

### Requirement: Batched sweep notifications
All notifications produced by one sweep SHALL be sent through the Resend batch API in chunks of at most 100, not as individual sends.

#### Scenario: Large sweep
- **WHEN** a sweep produces 150 notifications
- **THEN** exactly two batch API calls are made (100 + 50)
