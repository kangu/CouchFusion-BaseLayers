# Maintenance SMS Provider Layer Integration

## Summary
Updated maintenance notification dispatch to use the new shared `sms` layer for SMS sends.

## Changes
- Modified `server/utils/notification-adapters.ts`:
  - `sendSmsNotification()` now delegates to `#sms/server/utils/sender`.
  - adapter return contract remains unchanged (`ok`, `providerMessageId`, `errorMessage`).
- Existing email adapter behavior remains unchanged.
- Cron notification persistence and idempotency logic remain unchanged.
