## Initial Prompt
Right after uploading an image to imagekit, I don't see it show up in the Browse Select Image dialog. I need to refresh the page to see it. Make sure you always fetch the latest data when opening the dialog, so that right after uploading an image, it shows up there

## Implementation Summary
Implementation Summary: Image picker now refetches the ImageKit library every time the dialog opens, guaranteeing freshly uploaded files appear immediately without a full page refresh.

## Documentation Overview
- Updated the content admin image field to trigger a library fetch on every open instead of only when empty, ensuring post-upload visibility.
- Behavior applies to ImageKit mode and keeps existing folder defaults and fetch limits intact.

## Implementation Examples
- Dialog open hook now always triggers `fetchLibrary`: `layers/content/app/components/admin/ContentImageField.vue` (watch on `isLibraryOpen`).
