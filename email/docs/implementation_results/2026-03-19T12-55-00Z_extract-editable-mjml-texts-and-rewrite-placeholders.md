# Initial Prompt
I want to be able to process a raw MJML file and automatically extract the texts that might be changed inside the template, return them in an array, and return MJML with extracted text replaced by placeholders like `[slug]` (not `{{ }}`). Distinct placeholders per occurrence.

# Plan
1. Add a new utility function in `server/utils/email-templates.ts` for MJML text extraction + rewrite.
2. Keep existing template CRUD and existing `{{ }}` placeholder extraction untouched.
3. Add focused tests covering extraction, rewrite, dynamic-token preservation, and repeated-text handling.
4. Update layer README with the new utility usage note.

# Implementation Summary
Implemented new utility in `layers/email/server/utils/email-templates.ts`:
- `extractEditableMjmlTexts(mjml)`

Behavior:
- Scans MJML text nodes and extracts editable text fragments.
- Returns extracted fragments in encounter order (`texts: string[]`).
- Returns `transformedMjml` where extracted fragments are replaced with distinct placeholders:
  - `[new-lite-member]`, `[new-lite-member-2]`, etc.
- Preserves `{{ ... }}` dynamic tokens; they are not converted to `[slug]` placeholders.
- Ignores empty or non-alphanumeric chunks.

Added tests:
- `layers/email/server/utils/email-templates.spec.ts`
  - extraction of representative headline/body/button text,
  - distinct placeholder generation for repeated text,
  - mixed static + `{{dynamic}}` handling,
  - ignoring whitespace/punctuation-only chunks.

README update:
- Added “Editable Text Extraction (MJML)” note to `layers/email/README.md`.

# Verification Notes
Attempted:
- `bunx vitest --config vitest.config.ts --run email/server/utils/email-templates.spec.ts` from `layers/`

Result:
- Test process failed before running assertions due to the shared vitest setup requiring CouchDB connectivity in this environment (`connect EPERM ... :5984`).
- Utility code and test file were added successfully; test execution requires an accessible CouchDB test backend in this setup.

# Next Steps
1. Re-run the new spec in an environment where CouchDB test setup is reachable.
2. Optionally wire this utility into a dedicated API endpoint if UI-driven “extract + rewrite” workflow is needed.
