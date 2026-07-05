# Builder Search Position

## Summary
- Moved the `Search through content...` input from the admin editor header into the builder section tree.
- Placed it directly between the `+ Section` control row and the section list or empty state.
- Preserved sticky-to-top behavior by keeping positioning on `.builder-tree__search` and letting the input class handle only layout and visual styling.

## Verification
- `bun -e` Vue SFC compile check for `content/app/components/builder/Workbench.vue` and `content/app/components/admin/ContentAdminWorkbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the search row appears after add-section controls, before the section list, and computes to `position: sticky`.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
