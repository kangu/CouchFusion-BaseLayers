# Initial Prompt
Organize language flags and locale metadata inside the content layer so they can be imported from other projects.

# Plan
1. Create shared flag assets under the content layer.
2. Create shared `locales-meta` utility in the content layer.
3. Keep imports inline (`?raw`) to avoid runtime HTTP requests.
4. Keep locale metadata sync discoverable with developer warnings.

# Implementation Summary
Added shared locale metadata resources in `layers/content`:

- Added inline SVG assets:
  - `layers/content/app/assets/flags/en.svg`
  - `layers/content/app/assets/flags/fr.svg`
  - `layers/content/app/assets/flags/de.svg`
  - `layers/content/app/assets/flags/es.svg`
  - `layers/content/app/assets/flags/ro.svg`

- Added shared registry:
  - `layers/content/app/utils/locales-meta.ts`
  - Imports flags using `?raw`.
  - Exports `resolveLocaleMeta(localeCode)` and `hasLocaleMeta(localeCode)`.
  - Includes dev warning when metadata for a locale is missing.

Result: all consumer apps can import `#content/app/utils/locales-meta` and get shared labels + inline flags with no extra network requests.

# Next Steps
1. Expand the shared locale map as new locales are added to any app.
2. Add a CI validation step to enforce metadata coverage for configured locales.
