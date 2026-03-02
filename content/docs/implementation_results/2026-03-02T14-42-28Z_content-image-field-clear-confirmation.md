# ContentImageField clear confirmation

## Summary
Added a confirmation step to the clear-image workflow so accidental removals are avoided.

## Changes
- Updated `clearImage()` in `layers/content/app/components/admin/ContentImageField.vue`.
- Before clearing, the handler now opens a browser confirmation dialog:
  - Message: `Remove the selected image from this field?`
  - If canceled, the function returns early and preserves the current image.

## Result
Clicking `Remove` now requires explicit user confirmation before the image field is cleared.
