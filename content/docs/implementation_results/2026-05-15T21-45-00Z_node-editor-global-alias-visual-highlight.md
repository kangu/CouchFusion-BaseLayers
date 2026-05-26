# Node Editor Global Alias Visual Highlight

## Initial Prompt

Make global components inside the Node Editor more visually distinctive.

## Implementation Summary

- Updated `content/app/components/builder/NodeEditor.vue`.
  - Global alias nodes now show a visible `Global` badge in the header.
  - The alias panel now has a stronger blue left border, gradient top stripe, tinted header, and elevated blue shadow.
  - Normal component nodes keep the existing visual treatment.
- Extended `node-editor-test-utils.ts` so tests can pass `globalAliasIds`.
- Added `node-editor-global-alias.spec.ts` to verify only global alias nodes receive the global styling and badge.

## Verification

- `./node_modules/.bin/vitest --config vitest.config.ts content/tests/builder/node-editor-global-alias.spec.ts content/tests/builder/node-editor-search.spec.ts content/tests/builder/node-editor-highlight.spec.ts --run`

Passed: 3 files, 7 tests.
