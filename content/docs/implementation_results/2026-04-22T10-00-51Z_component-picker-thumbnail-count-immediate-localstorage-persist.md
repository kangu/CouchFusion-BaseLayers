# Component Picker Thumbnail Count Immediate localStorage Persist

## Initial Prompt
I want the local storage value to the thumbnails count to be saved right away after a change and not only on a successful component insert.

## Plan
1. Persist thumbnail count directly on slider input changes.
2. Ensure persistence logic is centralized and reused.
3. Remove initial watcher write behavior that can override existing stored value during mount.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Added direct input handler on range field:
  - `@input="handleThumbnailColumnsInput"`
- Added helper:
  - `persistThumbnailColumns(value)` -> writes immediately to `localStorage`.
- Added input handler:
  - `handleThumbnailColumnsInput(event)` clamps value and persists immediately.
- Updated existing `thumbnailColumns` watcher:
  - Uses `persistThumbnailColumns(...)` for consistency.
  - Changed `immediate` from `true` to `false` to avoid writing default value before loading stored state.

## Result
Thumbnail count is now persisted right away when the slider is changed, independent of component insert actions.

## Proposed Next Steps
1. Manually verify by changing slider value and reloading the dialog/page without inserting any component.
