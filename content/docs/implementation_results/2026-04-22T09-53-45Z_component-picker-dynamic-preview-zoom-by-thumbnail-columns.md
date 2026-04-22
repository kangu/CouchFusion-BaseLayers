# Component Picker Dynamic Preview Zoom By Thumbnail Columns

## Initial Prompt
The zoom level for each thumbnail count should be calculated dynamically so that the most amount of space is used to display the rendered thumbnails.

## Plan
1. Keep scope limited to `ComponentPickerDialog.vue`.
2. Compute preview scale from selected thumbnail columns (2..10).
3. Apply separate dynamic scale variables for desktop and mobile preview modes.
4. Replace fixed scaler CSS (`400%` / `0.25`) with variable-driven dimensions.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Added dynamic scale constants and computed values:
  - Desktop scale range: `0.34` (2 cols) -> `0.18` (10 cols)
  - Mobile scale range: `0.42` (2 cols) -> `0.24` (10 cols)
- Added interpolation helper tied to `thumbnailColumns`.
- Exposed computed scales as CSS custom properties on `.component-picker-grid`:
  - `--component-picker-preview-scale-desktop`
  - `--component-picker-preview-scale-mobile`
- Updated preview scaler class binding to include both states:
  - `is-desktop`
  - `is-mobile`
- Replaced fixed desktop zoom CSS with dynamic variable-based sizing and transform.
- Added mobile dynamic zoom CSS using the same pattern.

## Result
Zoom now adapts automatically as thumbnail columns change, using more of each thumbnail card space while preserving desktop/mobile preview mode behavior.

## Proposed Next Steps
1. Verify visually at `2`, `5`, and `10` columns in both Desktop and Mobile preview modes.
2. Tune min/max scale constants if you want tighter framing for either mode.
