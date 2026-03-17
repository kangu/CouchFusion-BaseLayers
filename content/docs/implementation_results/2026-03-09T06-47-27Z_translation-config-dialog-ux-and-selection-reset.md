# Translation Config Dialog UX + Selection Reset

Date: 2026-03-09

## Request
- Clear field-level translation checkbox selection after a successful translation request.
- Provide an explicit way to clear the selected checkbox batch from the Start Translation preparation dialog.
- Improve the Start Translation dialog UX with larger layout and friendlier locale selector buttons.

## Changes
- Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`.

### 1) Clear checkbox batch selection after successful translation
- In `runScopedTranslation`, when at least one locale translation succeeds, `selectedTranslationPointers` is reset to an empty list.
- Result: node editor translation checkboxes are cleared after successful translation runs.

### 2) Add clear-selection control in Start Translation dialog
- Added pending selection summary in dialog when selected pointers are present.
- Added `Clear selection` action that:
  - clears `selectedTranslationPointers`
  - clears `pendingTranslationPayload.selectedScopePointers`
  - resets scope label to `Page` for page-scope runs.

### 3) Improve translation dialog UX
- Enlarged Start Translation modal (`modal__panel--translation-config`).
- Refined form spacing and typography.
- Reworked destination locale picker into larger chip-style selectable buttons.
- Added inline locale quick actions: `Select all` / `Clear`.
- Locale chips now show inline flags and language labels via `resolveLocaleMeta`.
- Source locale dropdown now shows `Label (code)`.

## Validation
Executed:
- `bunx vitest --config vitest.config.ts content/tests/builder --run`

Result: all tests passed.
