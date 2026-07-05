# Actions Icon Only Muted Button

## Summary

Updated the builder header Actions trigger to be icon-only with a white muted button background.

## Changes

- Removed the visible `Actions` label from the top-right Actions trigger.
- Switched the trigger from primary styling to the muted white button styling.
- Kept `aria-label="Open actions menu"` so the icon-only button remains accessible.
- Kept the existing dropdown behavior and menu items unchanged.
- Added source-level coverage for the muted trigger and removed visible label.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: Actions trigger had empty visible text, retained `aria-label="Open actions menu"`, used white background, rendered only the chevron SVG, and opened the dropdown.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new Actions-trigger-specific console error was observed.
