# Global Alias Insert Defaults Hydration

## Initial Prompt

Fix a builder issue where fields for a newly dropped global section appeared empty in Node Editor until the first manual field mutation caused all saved default values to hydrate.

## Root Cause

Global aliases are runtime component definitions built from `/api/content/global-components`. The component picker can show their saved defaults through `previewProps`, but `Workbench` inserted new nodes through `createNode(componentId)`, which only knows the static component registry. For global alias IDs, the static registry has no prop defaults, so the inserted node started with an empty `props` object.

The existing `hydrateGlobalAliasProps()` path filled defaults later, but it only ran when the public global registry loaded or changed. If the registry was already loaded when the user inserted a global section, no hydration happened until a later mutation path touched the alias state.

## Implementation Summary

- Added `content/app/utils/global-alias-defaults.ts`.
  - Applies saved global alias defaults to a single node.
  - Applies defaults recursively to existing builder trees.
  - Preserves existing local props and internal builder/content metadata.
  - Deep-clones default values so editing a node cannot mutate registry defaults.
- Updated `Workbench.vue`.
  - Root global component inserts hydrate defaults before the node is added to the page.
  - Child global component inserts use the same immediate hydration path.
  - Existing tree hydration now uses the shared helper.
- Added regression tests in `content/tests/builder/global-alias-defaults.spec.ts`.

## Verification

- `./node_modules/.bin/vitest --config vitest.config.ts content/tests/builder/global-alias-defaults.spec.ts --run`
- `./node_modules/.bin/vitest --config vitest.config.ts content/tests/builder/global-alias-defaults.spec.ts content/tests/builder/node-editor-search.spec.ts content/tests/builder/node-editor-highlight.spec.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`

Both targeted runs passed with local CouchDB access enabled for the test harness.
