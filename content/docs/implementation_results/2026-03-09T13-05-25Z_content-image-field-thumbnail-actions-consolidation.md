# Initial Prompt
Update the content layer `ContentImageField.vue` to consolidate actions into the image thumbnail: click thumbnail to browse, show clear `X` on hover top-right, show ImageKit adjustments as a tools icon bottom-left, and keep URL input below image full width.

# Plan
1. Refactor preview area into a persistent, clickable thumbnail surface (including empty placeholder state).
2. Move browse/clear/tools interactions onto thumbnail overlays using existing handlers.
3. Remove separate Browse/Clear action row and keep URL input unchanged below.
4. Keep ImageKit adjustments panel logic and transformation behavior intact.
5. Apply minimal scoped CSS updates in component only.

# Implementation Summary
- Updated `layers/content/app/components/admin/ContentImageField.vue`.
- Preview area is now always rendered as a clickable thumbnail button:
  - Existing image when available.
  - Fixed empty placeholder when no image is set (`No image selected`, `Click to browse`).
  - Click triggers existing `openLibrary('imagekit')`.
- Added overlay actions on thumbnail:
  - Bottom-left tools icon button toggles `isImageKitPanelOpen`.
  - Top-right clear `✕` button calls existing `clearImage`.
  - Clear button is hover/focus-within revealed only.
- Removed standalone actions row (`Browse`/`Clear`) from controls.
- Kept URL input below image, full width.
- Kept ImageKit adjustment panel fields/reset logic untouched; only the toggle entry point moved from header text button to tools icon.
- Scoped styles updated for:
  - clickable thumbnail shell
  - empty placeholder presentation
  - overlay icon buttons and clear-on-hover behavior
  - controls row as single full-width input block

# Proposed Next Steps
1. Validate in admin workbench with both empty and populated image fields.
2. Optionally add a tiny tooltip on the tools icon (e.g., "ImageKit") for discoverability.
