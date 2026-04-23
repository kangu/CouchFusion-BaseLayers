# Font implementation cleanup (dead code removal)

## Removed as unnecessary
- Deleted unused main-settings merge helpers from `layers/content/server/utils/content-fonts.ts`:
  - `toPersistedContentFontSettings`
  - `mergeContentFontSettingsIntoMainSettings`
- Removed unused constant:
  - `FONT_STRETCH_PRESET_VALUES`

## Why
- These helpers were part of the early `--orders` persistence path and are no longer used after moving active writes to `--content`.
- Keeping them increased cognitive load without runtime value.

## Test updates
- Removed now-obsolete helper unit test from:
  - `layers/content/tests/server/font-assets.spec.ts`

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `8 passed`.
