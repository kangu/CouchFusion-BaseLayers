# Email Templates List Clone Action

## Request
Provide a way in the email templates list to clone an existing template into a new one.

## Implementation
Updated list UI and create API in the email layer:

- Added a `Clone` action next to `Edit` for each template row.
- Reused the existing create modal for cloning:
  - switches modal title/button text to clone mode,
  - pre-fills fields from the source template,
  - defaults the new name to `<source>_copy`.
- Clone submit now sends template content plus editable MJML metadata (`editableMjmlBase`, `editableMjmlEntries`) so cloned templates preserve detected editable fields state.
- API `POST /api/email-templates` now accepts and persists optional `editableMjmlBase` and `editableMjmlEntries`.

## Verification
- Build check passed:
  - `cd apps/gas-maintenance && bun run build`
- Playwright UI verification could not be completed at end of session because `http://localhost:6021/admin/email-templates` returned 404 (server route unavailable at that moment).

## Files Changed
- `layers/email/app/pages/admin/email-templates/index.vue`
- `layers/email/server/api/email-templates/index.post.ts`
