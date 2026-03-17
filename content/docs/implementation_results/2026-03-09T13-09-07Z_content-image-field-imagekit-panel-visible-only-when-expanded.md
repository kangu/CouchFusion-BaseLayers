# Initial Prompt
The ImageKit Adjustments bar should only be visible when it is in expanded mode, after clicking on the edit button on the thumbnail.

# Plan
1. Keep changes scoped to `ContentImageField.vue`.
2. Update panel rendering condition so the entire adjustments panel renders only when `isImageKitPanelOpen` is true.
3. Preserve all existing behavior for preview source checks and controls.

# Implementation Summary
- Updated `layers/content/app/components/admin/ContentImageField.vue`.
- Changed ImageKit panel wrapper condition from:
  - `previewUrl && isImageKitPreviewSource`
- To:
  - `previewUrl && isImageKitPreviewSource && isImageKitPanelOpen`
- Result:
  - The `ImageKit Adjustments` bar/panel is hidden in collapsed state.
  - It appears only after clicking the tools/edit icon on the thumbnail.

# Proposed Next Steps
1. Validate in the content admin UI that the tools icon toggles panel open/close as expected.
