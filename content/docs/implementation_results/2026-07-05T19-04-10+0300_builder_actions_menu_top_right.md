# Builder Actions Menu Top Right

## Summary

Moved the builder workbench Actions dropdown from the editor toolbar to the top-right workbench header, replacing the standalone plus button.

## Changes

- Replaced the top-right `+` button with an `Actions` dropdown trigger.
- Added `New Page` as the first dropdown item and wired it to the existing create-page modal flow.
- Moved the existing `Duplicate`, `Translate`, `Keep Animations Running`, and `Delete` actions into the top-right dropdown.
- Removed the old editor-toolbar actions chevron/dropdown while keeping the History control in the editor toolbar.
- Split the outside-click refs for History, Actions, and Translation menus so the moved dropdown can be interacted with reliably.
- Added source-level coverage for the new top-right Actions menu location and contents.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: top-right header contains translation tools followed by `Actions`; the standalone plus button is gone; Actions opens a dropdown with `New Page`, `Duplicate`, `Translate`, `Keep Animations Running`, and `Delete`; `New Page` opens the existing create-page modal.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new action-menu-specific console error was observed.
