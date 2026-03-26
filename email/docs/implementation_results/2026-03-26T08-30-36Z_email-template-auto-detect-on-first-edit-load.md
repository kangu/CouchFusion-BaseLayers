# Email Template Auto-Detect On First Edit Load

## Request
On `/admin/email-templates`, after clicking `Edit`, editable texts should already be visible as if `Detect texts from MJML` had been pressed.

## Problem
The detail page only hydrated editable rows from persisted fields (`editableMjmlBase` + `editableMjmlEntries`).
When these fields were missing, UI showed: `No editable texts detected yet. Click “Detect texts from MJML”.`

## Implementation
Updated `layers/email/app/pages/admin/email-templates/[id].vue`:

- Added one-time auto-detect state:
  - `pendingAutoDetectOnLoad`
  - `autoDetectedTemplateId`
- In `applyTemplateToEditor`:
  - If persisted editable fields exist, auto-detect is disabled.
  - If missing and MJML exists, auto-detect is scheduled.
- Added immediate watcher that triggers `detectTextsFromMjml()` once per loaded template when:
  - scheduled,
  - template has MJML,
  - detection is not already running,
  - entries are still empty.

This reuses the same detection pipeline as the button, so behavior stays consistent.

## Verification
- Build check:
  - `cd apps/gas-maintenance && bun run build` ✅
- Playwright MCP verification:
  1. Opened `http://localhost:6021/admin/email-templates`
  2. Clicked `Edit`
  3. Confirmed editable text rows are visible without manually clicking `Detect texts from MJML`.

## Files Changed
- `layers/email/app/pages/admin/email-templates/[id].vue`
