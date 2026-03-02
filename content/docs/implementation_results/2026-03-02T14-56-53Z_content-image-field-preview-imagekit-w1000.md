# ContentImageField ImageKit preview width transform

## Summary
Updated image previews in `ContentImageField.vue` so ImageKit-sourced preview URLs apply the `w-1000` transformation.

## Changes
- Updated imports in `layers/content/app/components/admin/ContentImageField.vue` to include `withImageKitTransformations`.
- Updated `buildPreviewUrl(filePath)`:
  - Still resolves source via `resolveImageKitUrl(...)`.
  - Now returns `withImageKitTransformations(resolved, { transformations: "w-1000" })` with configured endpoint.

## Result
When the preview source is ImageKit, the rendered preview uses the transformed URL segment `tr:w-1000`.
Non-ImageKit sources (local paths, external URLs, data/blob URLs) remain unchanged.
