# Font documents moved from `--orders` to `--content` DB

## Scope
- Moved content-font settings and font-attachment persistence to the content database.

## Changes
- Updated `layers/content/server/utils/content-fonts.ts`:
  - `getContentFontSettings()` now reads primary settings doc from `getContentDatabaseName()` using:
    - `content-settings:fonts`
  - Kept legacy fallback read from main settings doc in `--orders` (via `contentFonts`) for rollout safety.
  - `saveContentFontSettings()` now persists directly to `content-settings:fonts` in `--content`.
  - `applyContentFonts()` now:
    - writes `content-settings:font-assets` in `--content`
    - writes `content-settings:fonts` in `--content`
- Updated `layers/content/server/api/content/fonts/asset/[name].get.ts`:
  - resolves font attachment from `--content` first.
  - falls back to `--orders` only when missing (legacy transition support).

## Runtime behavior after change
- New writes are in `--content` DB only.
- Existing legacy font data in `--orders` remains readable during migration window.
- After first successful save/apply on the new build, active data is served from `--content`.

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `9 passed`.
