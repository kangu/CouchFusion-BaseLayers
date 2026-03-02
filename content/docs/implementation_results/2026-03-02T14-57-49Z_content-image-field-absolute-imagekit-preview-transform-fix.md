# ContentImageField absolute ImageKit preview transform fix

## Summary
Fixed preview URL generation so absolute ImageKit URLs also receive the `w-1000` transformation.

## Root cause
`buildPreviewUrl()` returned early for any `http(s)` source, which bypassed `withImageKitTransformations(...)`.

## Changes
- Updated `layers/content/app/components/admin/ContentImageField.vue`.
- Removed the early return for absolute URLs in `buildPreviewUrl(filePath)`.
- Existing transformation call remains in place, so ImageKit absolute URLs now get `tr:w-1000`.

## Result
A source like:
`https://ik.imagekit.io/indux/content-kktor/2f1f803de7937fa99c746a5fa1656315bc45615e_WHeFbZkK6.jpg`
now resolves to a transformed preview URL containing:
`/indux/tr:w-1000/content-kktor/...`
