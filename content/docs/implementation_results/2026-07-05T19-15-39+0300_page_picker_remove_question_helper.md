# Page Picker Question Helper Removed

## Summary
- Removed the circled question-mark helper from the builder header page-picker URL trigger.
- Kept the dotted URL text, caret affordance, aria label, and updated timestamp tooltip.
- Added source-level coverage to prevent the removed helper class from returning.

## Verification
- `bun -e "... @vue/compiler-sfc ..."`: SFC compile ok.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- `dev-browser --browser bitvocation-page-picker`: `/about` trigger rendered without `.content-admin-workbench__path-helper`, with caret and timestamp tooltip preserved.

## Notes
- Browser verification still reports the pre-existing Nuxt runtime-config `content` client warning seen in the workbench.
