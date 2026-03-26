# Email Template Detect First-Run Preview Values

## Request
Inside `/admin/email-templates/[slug]`, ensure the "Detect texts from MJML" flow works when fields were not previously processed (`editableMjmlEntries` empty), and on first run the preview renders resolved values instead of extracted placeholder keys.

## Implementation
Updated `layers/email/app/pages/admin/email-templates/[id].vue` in `detectTextsFromMjml()`:

- Kept detection/extraction flow unchanged (extract placeholders, build entries, attach href links, attach priority metadata).
- Introduced local `entriesWithPriority` variable so the same computed entries are reused for first-run rendering.
- Changed first-run transformation assignment:
  - Before: `editorState.mjml = transformedMjml` (placeholder tokens rendered in preview)
  - After: `editorState.mjml = renderMjmlFromEntries(transformedMjml, entriesWithPriority)`

This preserves first-run initialization of editable fields while compiling preview content with actual values.

## Verification
- Build check passed:
  - `cd apps/gas-maintenance && bun run build`
- No new build errors introduced (existing Tailwind sourcemap warnings remain non-blocking).

## Files Changed
- `layers/email/app/pages/admin/email-templates/[id].vue`
