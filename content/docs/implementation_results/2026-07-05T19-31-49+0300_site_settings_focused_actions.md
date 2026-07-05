# Site Settings Focused Actions

## Summary
- Moved typography access out of the builder controls and into the top-right Actions menu as `Site Typography`.
- Moved theme access out of the builder controls and into the Actions menu as `Site Theme`.
- Added focused-style editor panels for both site-wide settings inside the node editor area.
- Both panels use bottom `Cancel` and `OK` actions and return to the normal node editor tree after closing.
- `Cancel` resets unsaved local draft changes. Typography `OK` applies changed font settings; Theme `OK` saves changed draft tokens and applies the theme.

## Verification
- SFC compile passed for `content/app/components/builder/Workbench.vue` and `content/app/components/admin/ContentAdminWorkbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 2 files passed, 6 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 50 tests passed.
- `dev-browser --browser bitvocation-page-picker`: Actions menu showed `Site Typography` and `Site Theme`; each opened a focused panel with Cancel/OK and returned to the node tree after Cancel.

## Notes
- Browser verification still reports the pre-existing Nuxt runtime-config `content` client warning seen in the workbench.
