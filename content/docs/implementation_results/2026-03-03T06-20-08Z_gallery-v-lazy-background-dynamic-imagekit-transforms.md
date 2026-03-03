# Gallery v-lazy-background dynamic ImageKit transforms

## Summary
Updated Gallery rendering integration to apply per-image dynamic ImageKit transform values on top of fixed transform values via `v-lazy-background` URL generation.

## Updated render component
- `/Users/radu/Projects/indux/admin-backend/kktor-indux/frontends/indux/components/content/Gallery.vue`

## Changes
- Added `photosImagekitTransforms` prop support (array aligned by `photos` index).
- Added render-side transform prefix whitelist for ImageKit transformation tokens.
- Updated image URL builder to merge transforms in this order:
  1. source transforms (if legacy `tr:` exists)
  2. fixed transforms from template (`['w-1000']`)
  3. dynamic per-image transforms (`photosImagekitTransforms[index]`)
- Dynamic transforms override fixed/source values when prefixes match.
- Updated template call:
  - from `imageUrl(slide, ['w-1000'])`
  - to `imageUrl(slide, ['w-1000'], photoDynamicTransforms(index))`

## Result
`v-lazy-background` now remains the integration point and supports dynamic per-image transform overrides while preserving a controlled whitelist.
