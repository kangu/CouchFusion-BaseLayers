# Font attachments: ignore missing-attachment delete conflicts

## Issue
- `Apply Fonts` could fail with:
  - `CouchDB attachment deletion error: not_found - Document is missing attachment`

## Fix
- Updated attachment cleanup in `layers/content/server/utils/content-fonts.ts`:
  - when deleting stale attachments, treat CouchDB “missing attachment / not_found” responses as non-fatal.
  - continue apply flow and persist updated active attachment metadata.

## Why this is safe
- The target attachment is already absent, so desired end-state (“not present”) is satisfied.
- Hard failures are still preserved for other unexpected deletion errors.

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `9 passed`.
