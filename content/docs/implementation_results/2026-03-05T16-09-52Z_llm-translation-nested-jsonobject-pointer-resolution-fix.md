# Initial Prompt
When I try to start the translation, it looks like the object-nested value is not properly processed and I get an error for "No localizable source text entries found for the selected scope."

# Plan
1. Trace scoped translation pointer handling end-to-end for nested object fields.
2. Fix source entry extraction to include nested values stored in serialized `:propKey` JSON fields.
3. Fix translation apply path to write translated nested values back into serialized `:propKey` JSON fields.
4. Align fixed-path collection with serialized prop storage so localized nested fields are not incorrectly treated as fully fixed.
5. Ensure target-value lookup for `overwriteMode=missing` uses the same pointer resolution logic.

# Implementation Summary
- Updated `layers/content/server/utils/llm-translations-run.ts`:
  - Added JSON-string parsing support for serialized props (`:propKey`) during source pointer collection.
  - Nested strings inside serialized JSON object/array props are now emitted with normalized pointers (for example `/.../primaryButton/label`).
  - Added pointer resolution fallback (`resolvePointerTarget`) that can resolve both:
    - direct minimark path values
    - values nested inside serialized `:propKey` JSON strings
  - Updated `collectTranslatableTextEntries(...)` to use this resolver.
  - Updated `applyTranslationsToBody(...)` so nested translations are written back by:
    - modifying parsed JSON content
    - re-serializing back into the original `:propKey` storage field
  - Added `readPointerTextValue(...)` helper for consistent pointer reads.
  - Updated `resolveFixedBodyPaths(...)` to prefer incoming fixed paths from current source document when available (avoids stale legacy path pollution in translation runs).

- Updated `layers/content/server/api/content/llm-translations/translate.post.ts`:
  - Switched target text extraction (`overwriteMode=missing`) to `readPointerTextValue(...)` so nested serialized object fields are evaluated correctly.
  - Removed now-unused imports from the route.

- Updated `layers/content/utils/i18n-body.ts`:
  - Fixed fixed-path collector to understand serialized `:propKey` storage:
    - normalize key from `:propKey` to `propKey`
    - parse serialized JSON values before traversing schema fields
  - This allows nested `localized: true` fields to be handled at field level instead of treating the full serialized prop as an opaque fixed string.

# Next Steps
1. Re-test a nested localized field translation (for example `Landing.primaryButton.label`) using field-level Translate.
2. Confirm request no longer returns "No localizable source text entries found for the selected scope." for nested object fields.
3. Confirm staged target document diff includes updated nested value inside the serialized `:propKey` body value.
