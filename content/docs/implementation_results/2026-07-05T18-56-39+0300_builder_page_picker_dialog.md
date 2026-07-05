# Builder Page Picker Dialog

## Summary

Moved the builder page switcher out of the always-visible workbench panel and into a large page picker dialog opened from the current URL in the workbench header.

## Changes

- Replaced the top panel page search/datalist with a quiet current-path button in `ContentAdminWorkbench`.
- Added a modal page picker with focused search, current-page highlighting, compact table rows, and `Open`/`View` actions.
- Search now filters available pages by URL, title, SEO title, and SEO description.
- Page selection reuses `openPageForEditing(path)` so unsaved-change confirmation remains part of the existing workbench flow.
- Dialog closure happens after accepted page selection, while canceled unsaved-change confirmation keeps the dialog open.
- Added source-level builder coverage for the new page picker wiring and removed old inline search expectations.

## Verification

- `bun -e "... @vue/compiler-sfc ..."` from `/Users/radu/Projects/nuxt-apps/layers`: `SFC compile ok`
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts --run`: 1 test passed.
- `bunx vitest --config vitest.config.ts content/tests/builder --run`: 16 files passed, 48 tests passed.
- Dev browser check on `http://localhost:3012/k/about` authenticated as `radu`: URL trigger rendered, dialog opened, search was focused, filtering to `about` returned `/about`, old panel search was absent, and selecting `/` closed the dialog and routed the workbench to `/k/`.

## Notes

The browser console still reports pre-existing Nuxt client runtime-config warnings about accessing `content`; no page-picker-specific console errors were observed during the dialog checks.
