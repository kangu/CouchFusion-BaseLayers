# Initial Prompt
When I load the builder interface, I see the default font selected as Inter instead of the current Montserrat. When I make a save, it doesn't change the font, it keeps reverting back to the default Inter.

# Plan Followed
1. Trace how builder font defaults are loaded (`/api/content/fonts/settings`) versus how runtime/preload font assets are resolved (`/api/content/fonts/runtime.css`, `/api/content/fonts/active/*`).
2. Fix the mismatch by reconciling runtime CSS families with settings/allowlist on server reads.
3. Harden active-font endpoint resolution to prefer runtime CSS variables/faces first.
4. Validate with focused content font tests.

# Implementation Summary
- Root cause addressed:
  - settings API could normalize to config/default allowlist values (for example `inter`) while runtime CSS still served a different materialized family (for example `Montserrat`).
  - preload active endpoint then looked up faces using settings family and returned `404` despite runtime CSS containing valid faces.

- Applied fixes in [layers/content/server/utils/content-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-fonts.ts:1):
  - Added runtime CSS variable parsing:
    - `parseRuntimeFontVariables()`
  - Added runtime-config reconciliation from CSS:
    - merge runtime CSS families into allowlist
    - prefer runtime CSS `--font-sans` / `--font-display` as effective defaults
  - Updated `getContentFontSettings()`:
    - reads current runtime CSS from disk when present
    - returns effective settings aligned with currently active runtime families
  - Updated `resolveActiveRuntimeFontAsset()`:
    - resolves family candidates from runtime CSS variables first, then settings fallback, then parsed runtime faces
    - prevents false `No active font face found` for valid runtime faces.

- Added test coverage in [layers/content/tests/server/font-assets.spec.ts](/Users/radu/Projects/nuxt-apps/layers/content/tests/server/font-assets.spec.ts:1):
  - runtime CSS variable parsing for sans/display labels/slugs.

# Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1` file passed
  - `8` tests passed
