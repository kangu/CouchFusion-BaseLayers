# Component Picker Thumbnail Columns Range Persistence

## Initial Prompt
Proceed with the plan for implementing thumbnailCount.

## Plan
1. Add a range input in the Select Component dialog header on the same line as desktop/mobile toggle.
2. Implement columns-per-row control from 2 to 10.
3. Persist the selected value in localStorage and restore it on mount.
4. Keep desktop/mobile preview aspect ratio behavior unchanged.
5. Keep scope limited to `ComponentPickerDialog.vue`.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Header controls:
  - Added `component-picker-header-controls` wrapper.
  - Kept Desktop/Mobile toggle.
  - Added range control:
    - Label: `Thumbnails`
    - `min=2`, `max=10`, step 1
    - Displays current numeric value.
- State and persistence:
  - Added `thumbnailColumns` reactive value.
  - Added constants:
    - `THUMBNAIL_COLUMNS_MIN = 2`
    - `THUMBNAIL_COLUMNS_MAX = 10`
    - `THUMBNAIL_COLUMNS_STORAGE_KEY = "content-builder:component-picker:thumbnail-columns"`
  - Added clamp + load helpers.
  - Loaded persisted value on `onMounted()`.
  - Persisted updates via watcher with client guard.
- Grid behavior:
  - Bound a local CSS variable on grid container: `--component-picker-columns`.
  - Grid template now uses `repeat(var(--component-picker-columns, 2), minmax(0, 1fr))`.
- Aspect ratio sync:
  - Kept existing desktop/mobile preview ratio logic untouched (`.component-card-preview` + `.is-mobile-grid`).

## Result
Users can choose thumbnail columns per row (2–10), and the selection is restored from localStorage on subsequent openings/sessions.

## Proposed Next Steps
1. Verify manually in Select Component dialog:
   - Move slider and confirm columns update immediately.
   - Switch Desktop/Mobile and confirm aspect ratio remains correct.
   - Reload and confirm slider value persists.
