# Initial Prompt
How can we add `<link rel="preload">` when the font is set dynamically through the content config UI?

# Plan Followed
1. Add a fixed backend endpoint that resolves active configured font faces to current hashed managed assets.
2. Keep frontend preload links stable and point them to the fixed endpoint.
3. Add parser/selector helpers for runtime CSS face resolution.
4. Validate behavior with focused font utility tests.

# Implementation Summary
- Added fixed active-font resolver endpoint:
  - `GET /api/content/fonts/active/[key]`
  - Implemented in [layers/content/server/api/content/fonts/active/[key].get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/fonts/active/[key].get.ts:1)
  - Accepted key format:
    - `sans-400-normal.woff2`
    - `sans-700-normal.woff2`
    - optional stretch suffix like `sans-400-normal-125%.woff2`
  - Response behavior:
    - resolves currently active UI-configured family/style/weight/stretch
    - returns `302` redirect to `/fonts/managed/...hashed.woff2`
    - marks endpoint as no-store (`cache-control`)

- Extended font utils with runtime-face resolution:
  - [layers/content/server/utils/content-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-fonts.ts:1)
  - Added:
    - `parseRuntimeFontFaces(cssText)`
    - `findRuntimeFontFace(faces, payload)`
    - `resolveActiveRuntimeFontAsset(payload)`
  - Added validation to ensure redirected asset paths stay inside managed font public root.

- Updated runtime font plugin to preload fixed endpoints:
  - [layers/content/app/plugins/content-runtime-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/plugins/content-runtime-fonts.ts:1)
  - Adds:
    - preload `sans-400-normal`
    - preload `sans-700-normal`
  - Both include runtime version query for cache bust synchronization.

- Added targeted tests:
  - [layers/content/tests/server/font-assets.spec.ts](/Users/radu/Projects/nuxt-apps/layers/content/tests/server/font-assets.spec.ts:1)
  - New coverage for runtime CSS parsing and runtime face selection behavior.

# Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1` file passed
  - `7` tests passed
