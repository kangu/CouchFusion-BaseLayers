# Initial Prompt
Create and implement a reusable `maintenance` layer for the new `gas-maintenance` app, covering clients, contacts, expiry cron notifications, and employee job workflow.

# Implementation Summary
Implemented the `maintenance` Nuxt layer with CouchDB-backed domain models and APIs for clients/contracts/jobs/notifications, plus a cron expiry checker that sends idempotent reminders to company and customer recipients.

# Documentation Overview
- Added `layers/maintenance/nuxt.config.ts` with admin/navigation section contributions.
- Added DB bootstrap and design docs:
  - `layers/maintenance/server/utils/maintenance-db.ts`
  - `layers/maintenance/server/utils/design-documents.ts`
  - `layers/maintenance/server/plugins/init.ts`
- Added config + validation utilities:
  - `layers/maintenance/server/utils/config.ts`
  - `layers/maintenance/server/utils/parsers.ts`
  - `layers/maintenance/server/utils/contacts.ts`
  - `layers/maintenance/server/utils/dates.ts`
- Added role and audit support:
  - `layers/maintenance/server/utils/assert-maintenance-role.ts`
  - `layers/maintenance/server/utils/audit.ts`
- Added cron and notification services:
  - `layers/maintenance/server/utils/cron.ts`
  - `layers/maintenance/server/utils/notification-adapters.ts`
- Added API routes under `layers/maintenance/server/api/maintenance/**`.
- Added admin pages under `layers/maintenance/app/pages/admin/maintenance/**`.
