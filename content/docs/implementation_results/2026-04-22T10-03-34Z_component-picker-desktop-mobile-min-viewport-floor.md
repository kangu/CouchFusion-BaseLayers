# Component Picker Desktop/Mobile Minimum Viewport Floor

## Initial Prompt
As the size of the thumbnail decreases, the viewport should still be kept proportional so that when Desktop is selected, even if I have many thumbnails and small, I still get to see the Desktop version of those.

## Plan
1. Keep dynamic zoom scaling by thumbnail count.
2. Add minimum virtual viewport floors per mode (desktop/mobile).
3. Ensure scaler width/height remain proportional to each mode’s expected aspect.
4. Keep scope local to `ComponentPickerDialog.vue`.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Added constants:
  - `DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH = 1280`
  - `MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH = 420`
- Exposed these values as CSS custom properties on the grid container:
  - `--component-picker-preview-desktop-min-width`
  - `--component-picker-preview-mobile-min-width`
- Updated preview scaler CSS:
  - Desktop scaler now uses `max(...)` for width/height with a minimum desktop viewport floor and 4:3 proportional height.
  - Mobile scaler now uses `max(...)` for width/height with a minimum mobile viewport floor and 9:16 proportional height.

## Result
With many thumbnail columns, desktop mode still renders against a desktop-class virtual viewport (instead of collapsing into mobile/tablet responsive breakpoints), while preserving proportional scaling behavior.

## Proposed Next Steps
1. Verify visually at high thumbnail counts (8–10) in Desktop mode to confirm desktop layouts remain active.
2. Tune `DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH` / `MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH` if you want stricter or looser viewport floors.
