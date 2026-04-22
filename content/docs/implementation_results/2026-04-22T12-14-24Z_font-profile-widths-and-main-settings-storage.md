# Initial Prompt
What font width values do we have available coming through the bunny pipeline from the content layer feature for fonts? I would like to have them configurable in the ui so i can decide for each project how many widths I should use

# Plan
1. Inspect the current content-layer font pipeline and confirm whether width/stretch is supported today.
2. Add failing tests for width parsing/filtering and main-settings persistence.
3. Extend the server-side font profile model to include widths and store font settings in the main app `settings` document instead of the content DB doc.
4. Expose styles, weights, and widths in the Typography UI and send them through the existing admin settings/apply flow.
5. Run focused font tests plus the existing Bitvocation suite for regression coverage.

# Implementation Summary
## What changed
- Extended the content-layer font profile model to support:
  - `styles`
  - `weights`
  - `widths`
- Added `font-stretch` parsing and filtering to the Bunny CSS pipeline in:
  - `layers/content/server/utils/content-fonts.ts`
- Updated generated runtime CSS to emit:
  - `font-stretch`
  - alongside the existing `font-style` and `font-weight`

## Storage model change
- Font profile values are now persisted in the **main application settings document** instead of the content DB doc:
  - database defaults to `${dbLoginPrefix}-orders`
  - document id defaults to `settings`
  - stored under `contentFonts`
- Added server helpers in:
  - `layers/content/server/utils/database.ts`
  to resolve the main database/document with optional runtime overrides.
- Kept a legacy read fallback from `content-settings:fonts` in the content DB so existing projects keep their current values until they save/apply through the new path.

## UI change
- Expanded the Typography panel in `layers/content/app/components/builder/Workbench.vue` to expose:
  - family selection
  - style selection
  - weight selection
  - width selection
- Preview font loading now uses the selected styles/weights instead of the old hardcoded `300/400/700` preview set.
- Width choices are presented as CSS stretch presets:
  - `50%`
  - `62.5%`
  - `75%`
  - `87.5%`
  - `100%`
  - `112.5%`
  - `125%`
  - `150%`
  - `200%`
- The UI notes that only widths actually exposed by Bunny for the selected family will be materialized.

## Validation
- Added a focused Vitest config for the pure font pipeline:
  - `layers/content/vitest.fonts.config.ts`
- Ran:
```bash
./node_modules/.bin/vitest --config content/vitest.fonts.config.ts --run
```
- Result:
  - `1` test file passed
  - `4` tests passed

- Ran:
```bash
./layers/node_modules/.bin/vitest --config layers/bitvocation-content.vitest.config.ts --run
```
- Result:
  - `9` test files passed
  - `25` tests passed

# Next Steps
1. If you want width choices to be driven by live family-specific discovery instead of fixed CSS presets, the next step is to query Bunny family metadata/CSS and surface only the widths actually available for the selected families.
2. If you want this storage model applied across more apps, we can explicitly set `runtimeConfig.content.settingsDatabaseName` / `settingsDocumentId` per app instead of relying on the default main-db convention.
