# Node Editor Collapsed Prop Count

## Summary
- Replaced the collapsed section button text from `Expand` to a compact prop count such as `4 props`.
- Kept the existing CSS plus/minus affordance, so collapsed buttons render visually as `+ 4 props`.
- Expanded sections still show `Collapse`.
- The count uses the same visible component prop schema as the editor and excludes internal builder props.

## Verification
- `bun -e "... @vue/compiler-sfc ..."`: SFC compile ok for `NodeEditor.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/node-editor-highlight.spec.ts --run`: 1 file passed, 4 tests passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 51 tests passed.
- `dev-browser --browser bitvocation-page-picker`: live Bitvocation workbench showed collapsed section labels like `2 props`, `5 props`, and `4 props`, with CSS `+` markers and no remaining `Expand` text.

## Notes
- Browser verification still reports the pre-existing Nuxt runtime-config `content` client warning seen in the workbench.
