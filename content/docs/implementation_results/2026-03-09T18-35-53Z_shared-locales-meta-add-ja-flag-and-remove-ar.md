# Shared Locales Meta: Add Japanese Flag + Remove Arabic Entry

## Request Context
- Remove `ar` language/flag from active shared locale metadata.
- Add `ja` language/flag.

## Changes
- Added new flag asset:
  - `/layers/content/app/assets/flags/ja.svg`
- Updated shared locales metadata:
  - `/layers/content/app/utils/locales-meta.ts`
  - Added `flagJa` import.
  - Added `ja` entry with label `日本語`.
  - Removed `ar` entry/import (already removed in this session).
  - `tr` remains unchanged.

## Impact
- Any app consuming `#content/app/utils/locales-meta` now resolves Japanese label/flag.
- Arabic no longer resolves via shared locale metadata.
