# Shared Locales Meta: Add Korean Locale and Flag

## Request
Add Korean language and flag in shared locale metadata.

## Changes
- Added new inline SVG flag asset:
  - `/layers/content/app/assets/flags/ko.svg`
- Updated shared locale metadata in:
  - `/layers/content/app/utils/locales-meta.ts`
- Added import:
  - `flagKo` from `../assets/flags/ko.svg?raw`
- Added locale metadata entry:
  - `ko: { label: '한국어', flagSvg: flagKo }`

## Impact
- Any app/layer consuming `#content/app/utils/locales-meta` now resolves Korean label + flag.
- Translation and locale selectors that use shared metadata automatically get the new locale visuals.
