# History Button Icon Updated

## Summary
- Replaced the builder header History button SVG with the provided 16x16 history icon.
- Preserved the icon-only button behavior, `History` aria label, tooltip, disabled state, and dropdown wiring.
- Added source-level coverage for the new SVG viewBox and clock path.

## Verification
- `bun -e "... @vue/compiler-sfc ..."`: SFC compile ok.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- `dev-browser --browser bitvocation-page-picker`: live Bitvocation workbench rendered the History trigger with `viewBox="0 0 16 16"` and the requested clock path.

## Notes
- Browser verification still reports the pre-existing Nuxt runtime-config `content` client warning seen in the workbench.
