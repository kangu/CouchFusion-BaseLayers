# Component Picker Zoom Fit Sync With Viewport Floor

## Initial Prompt
This is good, but it seems the zoom needs to be adjusted as well in sync with the viewport so we still get to see everything horizontally on the small preview.

## Plan
1. Keep mode-specific virtual viewport floors (desktop/mobile).
2. Compute effective per-card zoom as the minimum between:
   - dynamic zoom from thumbnail count,
   - fit zoom required to keep min viewport width visible in the current thumbnail width.
3. Apply only in `ComponentPickerDialog.vue` preview scaler CSS.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Enabled container query sizing on preview container:
  - `.preview-pane { container-type: inline-size; }`
- Reworked scaler rules for both desktop and mobile:
  - Added fit-scale from current card width (`100cqw / minViewportWidth`).
  - Added effective-scale = `min(dynamicScale, fitScale)`.
  - Scaler width/height/transform now use effective-scale, so content fits horizontally.

## Result
At high thumbnail counts (small cards), preview auto-zooms out as needed to keep the full virtual viewport width visible horizontally. Desktop mode remains desktop-like, but no longer clips horizontally in small thumbnails.

## Proposed Next Steps
1. Verify in Desktop mode at 8–10 columns that full horizontal layout remains visible.
2. If needed, tune `DESKTOP_PREVIEW_MIN_VIEWPORT_WIDTH` and `MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH` for stricter/looser behavior.
