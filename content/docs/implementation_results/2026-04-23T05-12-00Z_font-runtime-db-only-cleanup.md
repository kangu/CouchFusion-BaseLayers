# Font runtime cleanup: DB/attachment-only

## Implemented
- Removed static app-level font bootstrap import from Bitvocation:
  - `apps/bitvocation/nuxt.config.ts`
  - dropped `~/assets/css/fonts.css` from `css` array

- Removed filesystem-dependent runtime paths in content font manager:
  - deleted managed-font disk read/write fallback code
  - deleted managed block updater for `app/assets/css/fonts.css`
  - `getRuntimeFontCss()` now uses persisted DB runtime CSS (or variable-only fallback), with no disk read fallback

- Tightened active font asset resolution:
  - `resolveActiveRuntimeFontAsset()` now accepts only attachment-backed URLs (`/api/content/fonts/asset/...`)
  - removed acceptance of local `/fonts/managed/...` and direct Bunny URLs

- Normalized runtime asset mode to attachment-only:
  - `runtimeAssetMode` now only `"attachment"` in server and app types

## Why
- Reduces implementation surface and removes legacy bootstrap/deployment coupling.
- Keeps runtime font behavior deterministic across dev/prod by relying on CouchDB docs + attachments only.

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `8 passed`.
