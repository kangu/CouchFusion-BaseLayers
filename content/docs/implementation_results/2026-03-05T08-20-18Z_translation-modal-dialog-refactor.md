# Translation UI Refactor: Inline -> Modal Dialog

## Scope
- Move translation progress and error/report display from inline editor header into a dialog.
- Keep translation operation modal while request is pending.

## Changes
- `content/app/components/admin/ContentAdminWorkbench.vue`
  - Added translation dialog state:
    - `isTranslationDialogOpen`
    - `translationModalTitle`
    - `translationModalSubtitle`
    - `translationHasDialogContent`
  - Opens dialog when translation starts and on translation errors.
  - Added `closeTranslationDialog()` that blocks close while translation is pending.
  - Removed inline header translation progress/report/error blocks.
  - Added a new teleported translation dialog containing:
    - notice banner (success/error)
    - animated progress indicator during pending state
    - translation report summary
    - key points list
    - per-locale open buttons and failure details
  - Added dialog-specific styles (`modal__panel--translation`, notice variants, key points styles).

## Validation
- `bun run build` from `apps/radustanciu` passed (SSR build successful).
