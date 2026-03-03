# ImageKit Transform Whitelist: Add `z`

## Scope
- Layer: `imagekit`
- File: `/Users/radu/Projects/nuxt-apps/layers/imagekit/utils/transform.ts`

## Change
- Added `z` (zoom) to `IMAGEKIT_TRANSFORM_PREFIX_WHITELIST`.

## Impact
- `sanitizeImageKitTransformations(...)` now allows `z-*` tokens.
- `mergeImageKitTransformations(...)` and downstream URL generation preserve zoom transforms instead of dropping them.

## Validation
- No TypeScript/API signature changes.
- Dependent Vue components compile successfully after integration.
