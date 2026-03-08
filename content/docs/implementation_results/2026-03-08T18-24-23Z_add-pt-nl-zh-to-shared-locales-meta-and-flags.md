# Initial Prompt
Add the Portuguese, Dutch and Chinese (zh) languages.

# Plan
1. Extend shared `locales-meta` in the content layer for `pt`, `nl`, and `zh`.
2. Add inline SVG flag assets for each new locale under shared layer flags.
3. Keep the existing shared API (`resolveLocaleMeta` / `hasLocaleMeta`) unchanged.

# Implementation Summary
Updated shared locale metadata and inline flags in `layers/content`:

- Added shared inline flag assets:
  - `layers/content/app/assets/flags/pt.svg`
  - `layers/content/app/assets/flags/nl.svg`
  - `layers/content/app/assets/flags/zh.svg`

- Updated `layers/content/app/utils/locales-meta.ts`:
  - Added imports for `pt`, `nl`, `zh` flags via `?raw`
  - Added locale entries:
    - `pt` => `Portugues`
    - `nl` => `Nederlands`
    - `zh` => `中文`

Result: any app importing `#content/app/utils/locales-meta` now gets Portuguese, Dutch, and Chinese labels/flags with inline SVG payloads and no extra flag HTTP requests.

# Next Steps
1. Keep this shared map updated whenever locale sets expand in consuming apps.
2. Add CI coverage checks to ensure every configured locale has shared metadata and a flag.
