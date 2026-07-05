# Builder Updated Timestamp Tooltip

## Summary

Removed the visible `Updated` timestamp from the builder editor header and moved the timestamp to the current page URL tooltip.

## Changes

- Added `pagePickerTooltip`, using the existing `lastUpdatedDisplay` value.
- Bound the page-picker URL trigger `title` to `pagePickerTooltip`.
- Removed the visible `Updated {{ lastUpdatedDisplay }}` status label.
- Removed the now-unused `.editor-header__status-time` style.
- Updated source-level coverage to ensure the tooltip binding exists and the visible updated label stays removed.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: visible `Updated` label was absent, `.editor-header__status-time` was absent, and the `/about` page-picker trigger title contained `05/07/2026, 18:25:46`.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new timestamp-tooltip-specific console error was observed.
