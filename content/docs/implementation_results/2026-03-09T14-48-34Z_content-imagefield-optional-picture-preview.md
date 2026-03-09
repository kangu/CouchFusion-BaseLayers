# Initial Prompt
Update `layers/content/app/components/admin/ContentImageField.vue` to optionally render a `<picture>` preview with media-breakpoint `<source>` entries whose URLs are composed from ImageKit transforms, with minimal impact.

# Plan
1. Extend `ContentImageField.vue` preview rendering to support optional `<picture>` output while preserving existing `<img>` fallback behavior.
2. Read responsive source configuration from `propDefinition.ui` (`usePicturePreview` + `pictureSources`).
3. Compose each `<source>` URL from configured transforms merged with live ImageKit adjustment controls.
4. Keep upload/browse/store contracts unchanged.

# Implementation Summary
- Added optional responsive preview mode in `ContentImageField.vue`.
- New UI configuration contract (optional):
  - `ui.usePicturePreview: true`
  - `ui.pictureSources: [{ media: string, transforms: string, type?: string }]`
- Added computed parsing/normalization for responsive source config.
- Added computed `responsivePicturePreviewSources` that builds each `srcset` via `buildPreviewUrl(filePath, baseTransforms)` where:
  - `baseTransforms` comes from each `pictureSources` item
  - live adjustment transforms (`imageKitTransformString`) are merged on top
- Updated preview template:
  - Uses `<picture>` with `<source>` list when configured and valid
  - Falls back to existing `<img>` otherwise
- Kept existing behavior for upload, library, model value, and transform value untouched.

# Proposed Next Steps
1. Add a small builder schema example in docs showing `ui.usePicturePreview` and `ui.pictureSources` usage.
2. Optionally allow `transforms` as string array if desired in future schema evolution.
