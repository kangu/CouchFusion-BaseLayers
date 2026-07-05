# Translation Button Icon Size Matched

## Summary
- Updated the builder header translation trigger to match the compact icon-button sizing used by History and Actions.
- Set the translation trigger to `min-width: 2.5rem` with matching inline padding.
- Removed the translation-specific `1.35rem` icon override so it uses the standard `16x16` small icon size.

## Verification
- `bun -e "... @vue/compiler-sfc ..."`: SFC compile ok.
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 file passed, 2 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 49 tests passed.
- `dev-browser --browser bitvocation-page-picker`: live Bitvocation workbench measured translation and History buttons at `40x34` with `16x16` icons and matching inline padding.

## Notes
- Browser verification still reports the pre-existing Nuxt runtime-config `content` client warning seen in the workbench.
