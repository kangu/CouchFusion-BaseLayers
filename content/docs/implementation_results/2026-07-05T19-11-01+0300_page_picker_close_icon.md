# Page Picker Close Icon

## Summary

Replaced the page picker dialog close button text glyph with the supplied inline SVG icon.

## Changes

- Updated only the page picker dialog close button.
- Kept the existing `aria-label="Close page picker"` and `closePagePicker` click behavior.
- Added focused source coverage for the supplied SVG path.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: page picker close button rendered the supplied SVG, had no text glyph, and still closed the dialog.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new close-button-specific console error was observed.
