# Maintenance Layer Feature Readiness Analysis

## Current Layer State
- Provides complete MVP surface for:
  - clients
  - contracts
  - jobs status transitions
  - expiry cron
  - notifications log
- Uses CouchDB design docs and role-guarded APIs.
- Reads env parameters from CouchDB `_config` via `cf_env_[appSlug]` convention.

## Strengths
- Layer boundaries are clean: shared domain logic lives in layer, app remains thin.
- Role checks and audit entry writes are present across mutating endpoints.
- Cron flow includes idempotency keys and duplicate detection checks.

## Immediate Gaps
1. Notification adapters are mock implementations.
2. Failed sends are stored but not retried.
3. No layer-level automated tests for critical domain behavior.
4. No pagination strategy in read endpoints.
5. Some workflow policies are not encoded (for example mandatory rejection reason, assignment lifecycle).

## Implementation-Ready Focus
1. Provider adapter abstraction finalization (email/SMS concrete drivers).
2. Retry worker/backoff policy for `failed` notifications.
3. Integration test suite covering cron and job transitions.
4. Query pagination/filter contracts for all list APIs.
