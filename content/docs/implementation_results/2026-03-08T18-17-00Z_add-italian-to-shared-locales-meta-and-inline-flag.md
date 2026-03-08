# Initial Prompt
Add the Italian language.

# Plan
1. Extend shared content-layer locale metadata with an Italian entry.
2. Add an inline SVG flag asset for Italy in the shared flags folder.
3. Keep the existing shared metadata structure unchanged.

# Implementation Summary
Updated shared locale metadata and assets in `layers/content`:

- Added flag asset:
  - `layers/content/app/assets/flags/it.svg`

- Updated `layers/content/app/utils/locales-meta.ts`:
  - Added import: `flagIt` from `../assets/flags/it.svg?raw`
  - Added locale entry:
    - key: `it`
    - label: `Italiano`
    - `flagSvg: flagIt`

Result: consumer apps importing `#content/app/utils/locales-meta` now receive Italian locale metadata and inline flag support.

# Next Steps
1. If other apps add `it` to their i18n locale list, they will immediately render the shared Italian label and flag.
2. Keep expanding the shared map as new locales are introduced.
