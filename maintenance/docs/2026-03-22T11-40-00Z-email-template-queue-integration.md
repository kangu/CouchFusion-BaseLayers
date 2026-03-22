# Maintenance Email Template Queue Integration

## Summary
Switched maintenance email notification delivery from mock sender behavior to template-payload queueing in `email-sender`, aligned with the Bitvocation contact flow pattern.

## What changed
- Updated `server/utils/notification-adapters.ts`:
  - `sendEmailNotification()` now calls `#email/server/utils/template-queue`.
  - Email payload contract is now template-driven (`to`, `template`, `payload`).
- Updated `server/utils/cron.ts`:
  - Cron email notifications now use template IDs already stored in notification documents (`<category>_default`).
  - Enqueued payload now includes:
    - `clientName`, `clientId`, `expirationDate`
    - `category`, `reminderLabel`, `recipientRole`, `reminderText`
- Kept existing maintenance notification status model unchanged:
  - Queue write success => `sent`
  - Queue write failure => `failed`
- SMS delivery path remains unchanged.

## Impact
- Minimal blast radius: only maintenance cron email dispatch path changed.
- Existing notification idempotency and persistence flow remains intact.
- Enables app-managed templates in `email-sender` to compose final messages from payload.
