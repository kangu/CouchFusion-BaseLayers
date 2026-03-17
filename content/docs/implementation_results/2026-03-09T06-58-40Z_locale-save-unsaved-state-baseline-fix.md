# Locale Save Unsaved-State Baseline Fix (ContentAdminWorkbench)

Date: 2026-03-09

## Request
After saving a locale document, navigating away still triggers the unsaved-changes confirmation even though the save succeeded.

Constraint: apply fix only in `ContentAdminWorkbench` with minimal impact.

## Root Cause
`handleSaveDocument` used the pre-save builder serialization as `lastSavedSnapshot`.
For localized saves, server-persisted documents can differ (notably i18n metadata/timestamps), so the next builder `document-change` compared against an outdated snapshot and marked the page as dirty again.

## Changes
Updated:
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`

### 1) Canonicalize selected path as base path
- Added `toBasePath()` helper using `resolveContentLocalePath(...).basePath`.
- `selectedPath` updates now keep canonical base path instead of locale-prefixed path.
- Applied in:
  - selected summary path watcher
  - `openPageForEditing`
  - `handleSaveDocument` after save

### 2) Re-baseline snapshot from persisted document after save
- In `handleSaveDocument`, after successful save:
  - derive `savedMinimalDocument` from `savedSummary.document` (fallback to serialized doc)
  - set `lastSavedSnapshot` from that saved canonical document
  - set `latestDocument` from saved canonical document
  - if saved snapshot differs from current builder snapshot, call `builder.loadDocument(savedMinimalDocument)` to align editor state to persisted state
  - keep `updateUnsavedState(false)`

Result: locale save no longer immediately re-triggers dirty state from post-save canonicalization.

## Validation
Executed:
- `bunx vitest --config vitest.config.ts content/tests/builder --run`

Result: all tests passed.
