# Content fonts: CouchDB attachment-backed runtime persistence

## Summary
- Switched runtime font asset persistence from filesystem-dependent managed files to CouchDB attachments for production-safe behavior.
- Added a dedicated assets document: `content-settings:font-assets`.
- Updated apply workflow to:
  - resolve selected Bunny faces,
  - upload needed `.woff2` files as attachments,
  - prune stale attachments,
  - render and persist `runtimeCssText` referencing `/api/content/fonts/asset/<attachment>.woff2`.
- Kept best-effort local CSS mirroring (`runtime-fonts.css` and `app/assets/css/fonts.css`) as non-critical compatibility output.

## API changes
- Added public runtime font asset endpoint:
  - `GET /api/content/fonts/asset/:name`
  - Streams `.woff2` directly from CouchDB attachment storage.
- `GET /api/content/fonts/active/:key` now accepts attachment-backed resolved URLs in addition to legacy `/fonts/managed/*` and Bunny URLs.

## State/model updates
- Extended `contentFonts.runtimeAssetMode` to include `"attachment"`.
- Default runtime asset mode now initializes as `"attachment"`.
- Runtime CSS path default aligned to `/api/content/fonts/runtime.css`.

## Bug fixes included
- Prevented saved font families from being force-overwritten by existing runtime CSS when persisted selections already exist.
- Improved active-face resolution behavior to select the closest available weight when exact weight is unavailable (reduces preload 404s for rigid key requests like `sans-700-normal`).

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `9 passed`.
