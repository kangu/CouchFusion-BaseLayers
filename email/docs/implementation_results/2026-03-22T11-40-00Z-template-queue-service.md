# Email Template Queue Service

## Summary
Added a reusable server utility for queueing template + payload emails into the shared `email-sender` database update handler.

## What changed
- Added `server/utils/template-queue.ts`:
  - Exposes `queueTemplateEmail()`.
  - Resolves app template prefix using `getEmailTemplatePrefix(runtimeConfig.dbLoginPrefix)`.
  - Posts payload to:
    - `/email-sender/_design/pending_emails/_update/build_template_with_payload/<prefixed-template-id>`
  - Uses `COUCHDB_ADMIN_AUTH` for Basic auth.
  - Returns normalized `{ ok, providerMessageId, errorMessage }` result.
- Added unit tests in `server/utils/template-queue.spec.ts`:
  - success path endpoint/header/body assertions
  - non-OK response mapping
  - missing auth behavior
- Added isolated test config `email/vitest.config.ts`:
  - runs email unit tests without shared CouchDB harness coupling.

## Verification
- `cd layers && bunx vitest --config email/vitest.config.ts --run email/server/utils/template-queue.spec.ts` (pass)
