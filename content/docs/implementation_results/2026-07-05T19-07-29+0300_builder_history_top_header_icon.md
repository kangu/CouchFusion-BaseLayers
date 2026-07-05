# Builder History Top Header Icon

## Summary

Moved the builder History control from the editor toolbar to the top-right workbench header next to the translation/language control.

## Changes

- Moved the existing History trigger and dropdown into the top header actions area.
- Placed History immediately after the translation/language button and before the Actions dropdown.
- Converted the History trigger from text to an icon-only button with `aria-label="History"` and `title="History"`.
- Removed the old editor-toolbar History button and dropdown classes.
- Reused the existing history selection logic, current-version item, loading/error states, and outside-click/escape behavior.
- Updated source-level coverage for the new header placement and removed editor-toolbar History selectors.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: header controls rendered as translation icon, History icon, and Actions; the old toolbar History button was absent; clicking History opened the dropdown with `Current version`.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new history-menu-specific console error was observed.
