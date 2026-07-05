# Workbench Title Placeholder Compact

## Summary
- Changed the builder workbench default title fallback from `Content Builder` to `...`.
- This keeps the top-left page-picker/header area compact before a selected page path is available.
- Added source-level coverage to prevent the long fallback from returning.

## Verification
- `bun -e "... @vue/compiler-sfc ..."`: SFC compile ok.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.

## Notes
- This is a loading/empty fallback source change; the live Bitvocation route quickly resolves to the actual page path.
