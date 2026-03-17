# Translation Persist: Missing Encoded Button Bootstrap

## Request
When persisting translations, initialize missing encoded button props (example: `:secondaryButton`) in target locale documents instead of skipping them.

## Root Cause
- Translation apply resolves pointers against the target locale body.
- For pointers like `/.../secondaryButton/label`, if target body has neither `secondaryButton` nor `:secondaryButton`, resolution returned `null` and skipped write.
- There was no bootstrap path from source encoded props.

## Changes
- Updated `layers/content/server/utils/llm-translations-run.ts`:
  - `resolveEncodedPointerTarget(...)` now accepts optional `sourceBodyValue`.
  - If target encoded prop is missing but source contains encoded JSON (for example `:secondaryButton`), resolver bootstraps from source parsed root and resolves nested pointer writes.
- Updated `applyTranslationsToBody(...)` to accept options with `sourceBodyValue`.
- Updated `layers/content/server/api/content/llm-translations/translate.post.ts`:
  - pass `sourceDocument.body.value` into `applyTranslationsToBody(...)`.

## Expected Result
- Target locale docs missing `:secondaryButton`/`:primaryButton` now get initialized during translation apply.
- Nested translated keys (for example `label`) persist correctly under encoded props instead of being skipped.
