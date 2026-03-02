# ImageKit transform propagation to iframe live preview

## Summary
Implemented propagation of ImageKit transformation controls from `ContentImageField` into the persisted image `src` value and made Gallery rendering compatible with source-level `tr:` transforms while still applying its local width transform.

## Changes

### 1) Persist transform controls into `src` updates
- File: `layers/content/app/components/admin/ContentImageField.vue`
- Updated `ensureAbsoluteUrl()` so ImageKit URLs (including absolute URLs) are normalized via `buildPreviewUrl(...)` instead of returning raw `http(s)` values.
- Added a watcher on `imageKitTransformString` that calls `commitValue()` when the current value is ImageKit, so transform control edits emit updated `src` values to the builder data model.

### 2) Keep Gallery width transform compatible with source transforms
- File: `/Users/radu/Projects/indux/admin-backend/kktor-indux/frontends/indux/components/content/Gallery.vue`
- Updated `imageUrl(source, transformations)` to:
  - extract existing `tr:` transforms from the incoming source URL,
  - merge them with the call-site transformations (`['w-1000']`),
  - apply merged transforms via `withImageKitTransformations(...)`.
- Merge behavior is key-based (`w`, `h`, `c`, `fo`, `q`, `f`, etc.); call-site transforms override source transforms for the same key, while non-conflicting source transforms are preserved.

## Result
ImageKit adjustments made in the admin field now travel through the `src` prop into iframe live preview, and `Gallery.vue` no longer drops those source transforms when it applies `w-1000`.
