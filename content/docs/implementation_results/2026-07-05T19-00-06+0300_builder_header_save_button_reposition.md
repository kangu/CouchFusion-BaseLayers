# Builder Header Save Button Reposition

## Summary

Moved the primary builder save action from the editor toolbar to the left of the current URL page-picker trigger.

## Changes

- Added the primary save button to the `ContentAdminWorkbench` top header before the clickable current URL.
- Shortened the button label from `Save Changes` to `Save`.
- Removed the duplicate primary save button from the editor toolbar while keeping History and save actions in place.
- Added source-level coverage to ensure the shortened `Save` label appears before the page-picker trigger and the old `Save Changes` label is absent from the component.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 test passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 48 tests passed.
- Dev browser check on `http://localhost:3012/k/about`: header controls rendered as `Save` followed by `/about`, no visible `Save Changes` button.

## Notes

The browser console still reports the pre-existing Nuxt client runtime-config warning about accessing `content`; no new error was observed during the header check.
