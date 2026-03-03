# ImageKit transform merge/extract/whitelist helpers

## Summary
Extended ImageKit transformation utilities with reusable helpers for extracting transforms from URLs, merging fixed and dynamic transforms, and filtering by allowed prefixes.

## Updated file
- `layers/imagekit/utils/transform.ts`

## Additions
- `IMAGEKIT_TRANSFORM_PREFIX_WHITELIST`
- `splitImageKitTransformations(...)`
- `sanitizeImageKitTransformations(...)`
- `mergeImageKitTransformations(fixed, dynamic, ...)`
- `extractImageKitTransformations(source, endpoint?)`

## Notes
- `withImageKitTransformations(...)` now sanitizes transformations through the whitelist-aware helper before injecting the `tr:` segment.
- Merge semantics are prefix-aware; later (dynamic) values override earlier (fixed) values when prefixes match.
