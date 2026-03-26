# Maintenance Layer Current-State Readiness Analysis

## Scope
- Reviewed server APIs, utils, init migration plugin, and admin pages in `layers/maintenance`.
- Reviewed layer documentation history through March 22, 2026.
- Reviewed consuming app integration in `apps/gas-maintenance`.

## Layer Status
- Layer is functional and integrated for:
  - clients + contact validation/normalization
  - multi-schedule expiration model
  - reservation-aware jobs lifecycle
  - cron-triggered job creation and notification dispatch
  - audit writes on mutating flows
- Provider integration is partially completed:
  - SMS dispatch uses shared `sms` layer sender
  - Email dispatch uses `email` layer template queue path

## Technical Observations
1. Read/query scalability:
- list endpoints are currently non-paginated and return full sets.
2. Notification reliability:
- failures are persisted but no retry worker/backoff implementation exists.
3. Transition/API cleanup:
- `jobs/[id]/status` payload includes `nextExpirationDate` and returns `followUpJob`, but follow-up job creation is not currently used (field remains null).
4. Legacy compatibility:
- init plugin includes migrations from old contract and status models; compatibility behavior is present and active.

## Verification
- Consuming app build (`apps/gas-maintenance`, `bun run build`) succeeds after integrating this layer.

## Immediate Implementation Priorities
1. Add retry worker + bounded policy for failed notifications.
2. Add integration tests around:
- cron idempotency
- status transitions (`pending/scheduled -> done/rejected/canceled_by_customer`)
- expiration date/status updates on completion
3. Introduce pagination/filter contracts for clients/jobs/notifications endpoints.
4. Remove or complete stale API fields (`nextExpirationDate`, `followUpJob`) to reduce interface ambiguity.

