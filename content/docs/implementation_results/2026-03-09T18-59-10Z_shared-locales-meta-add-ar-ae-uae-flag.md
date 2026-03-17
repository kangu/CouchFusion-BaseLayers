# Shared Locales Meta: Add Arabic (UAE) Locale + UAE Flag

## Request
Add Arabic UAE variation with UAE flag specifically.

## Changes
- Added new inline flag asset:
  - `/layers/content/app/assets/flags/ae.svg`
- Updated shared locale metadata:
  - `/layers/content/app/utils/locales-meta.ts`
  - Added import: `flagAe` from `../assets/flags/ae.svg?raw`
  - Added entry:
    - `'ar-ae': { label: 'العربية (الإمارات)', flagSvg: flagAe }`

## Impact
- Any app using `#content/app/utils/locales-meta` now resolves `ar-ae` with an explicit UAE flag.
- Generic `ar` remains absent, so this is an explicit region-specific Arabic variant.
