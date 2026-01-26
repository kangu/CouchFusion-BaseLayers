## Initial Prompt
After uploading, make sure to close the dialog.

## Plan
1. Adjust the ImageKit upload flow to close the library once an upload succeeds.
2. Keep the library refresh so newly uploaded items stay in sync before closing.

## Implementation Summary
- Updated `ContentImageField.vue` (ImageKit upload handler) to fetch the latest library results and then close the dialog after a successful upload, so users return to the field immediately post-upload.

## Next Steps
- Verify in the ImageKit tab: upload an image, confirm the dialog closes automatically and the selected URL populates the field.
