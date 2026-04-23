# Font preload dedupe: direct asset URLs (no redirect preload)

## Problem
- Runtime preloads used `/api/content/fonts/active/*` redirect endpoints.
- CSS `@font-face` used direct `/api/content/fonts/asset/*` URLs.
- Browser fetched same 400/700 faces twice (preload redirect chain + CSS fetch).

## Change
- Added new public endpoint:
  - `GET /api/content/fonts/preload`
  - resolves active sans 400/700 to direct attachment-backed URLs via `resolveActiveRuntimeFontAsset`.
- Updated runtime plugin:
  - `layers/content/app/plugins/content-runtime-fonts.ts`
  - fetches `/api/content/fonts/preload` and injects direct preload links from response.
  - keeps stylesheet URL versioning for runtime CSS.
  - retains active-endpoint preload fallback only if preload API fetch fails.

## Expected result
- Preloaded URL and CSS URL for 400/700 now match (`/api/content/fonts/asset/...`).
- Redirect-based duplicate font downloads for these faces should disappear.

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `8 passed`.
