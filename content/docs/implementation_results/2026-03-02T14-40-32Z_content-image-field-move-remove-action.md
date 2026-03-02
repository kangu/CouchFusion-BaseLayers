# ContentImageField remove action placement

## Summary
Moved the image remove action in `ContentImageField.vue` from the preview-frame overlay to the controls action row next to the `Browse` button.

## Changes
- Updated template in `layers/content/app/components/admin/ContentImageField.vue`:
  - Removed the overlay `Remove` button from inside `.image-field__preview`.
  - Added a `Remove` action button in `.image-field__actions` (shown only when `previewUrl` exists).
- Updated scoped styles:
  - Removed obsolete `.image-field__clear` overlay style block.
  - Reused existing `.image-field__button--danger` style variant for the new `Remove` action.

## Result
The remove action is now in the control toolbar, aligned with existing browse actions, and no longer overlays the image preview.
