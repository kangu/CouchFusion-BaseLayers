# Initial Prompt
Refactor to discard any content from between <mj-style> tags

# Plan
1. Update MJML text extraction utility to skip extraction/rewrite operations for text nodes located inside `<mj-style>...</mj-style>` blocks.
2. Add a regression test that proves style content is preserved and not extracted.

# Implementation Summary
Updated:
- `layers/email/server/utils/email-templates.ts`

Changes:
- Added `MJ_STYLE_BLOCK_PATTERN` to identify `<mj-style>` block ranges.
- Added helper functions:
  - `collectMjStyleRanges(mjml)`
  - `isInsideRanges(index, ranges)`
- In `extractEditableMjmlTexts`, text-node replacement now checks match offset and skips any node inside style ranges.

Test update:
- `layers/email/server/utils/email-templates.spec.ts`
- Added test:
  - style content containing readable strings is not extracted/replaced,
  - non-style body text is still extracted/replaced as before.

# Result
- Strings inside `<mj-style>` are discarded from editable-text detection.
- Only actual content text outside style blocks is extracted and rewritten.

# Next Steps
1. Validate in UI by running “Detect texts from MJML” on a template containing `<mj-style>` content and confirm style text is excluded.
