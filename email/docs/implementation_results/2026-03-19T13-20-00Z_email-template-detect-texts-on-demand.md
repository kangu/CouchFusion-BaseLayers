# Initial Prompt
plug in that utility into the page /admin/email-templates/admin_order_lite And update on demand from the mgml a list of detected texts. Place that under the Dynamic Parameters panel.

# Clarification
Applied for all template detail pages, as confirmed.

# Plan
1. Add a dedicated authenticated API endpoint in `layers/email` to run MJML text extraction on demand.
2. Wire the email template detail page to call the endpoint from a button under Dynamic parameters.
3. Render detected texts list in the same panel and keep behavior isolated from existing save/compile flows.

# Implementation Summary
## API
Added new endpoint:
- `layers/email/server/api/email-templates/extract-texts.post.ts`

Behavior:
- Requires admin session (`assertAdminSession`).
- Accepts `{ mjml: string }`.
- Runs `extractEditableMjmlTexts(mjml)` from email utils.
- Returns:
  - `success`
  - `texts: string[]`
  - `transformedMjml: string`

## Page integration
Updated:
- `layers/email/app/pages/admin/email-templates/[id].vue`

Changes:
- Added on-demand action button under **Dynamic parameters**:
  - “Detect texts from MJML”
- Added local state:
  - `isDetectingTexts`
  - `detectedEditableTexts`
  - `detectTextsError`
- Added handler `detectTextsFromMjml()` that POSTs to `/api/email-templates/extract-texts` using current editor MJML.
- Added list rendering for detected texts under the same panel.
- Clears detected text results when MJML changes (to avoid stale list after edits).

Result:
- All email template detail pages (`/admin/email-templates/:id`) now support manual detection of editable MJML text segments and show them under Dynamic parameters.
- Existing compile/save flow remains unchanged.

# Next Steps
1. In UI, open any template detail page and click “Detect texts from MJML” to verify extracted list updates as expected.
