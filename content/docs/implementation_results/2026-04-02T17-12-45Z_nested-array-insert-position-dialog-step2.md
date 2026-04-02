# Initial Prompt
Proceed with step 2 now, for handling insert position for nested arrays

## Plan
1. Extend node-editor dialog composable to support nested insert-position contexts.
2. Reuse existing append+move helpers for insertion at chosen position to minimize data-layer impact.
3. Wire new nested insert handlers through `NodeEditor -> NodePropsPanel -> NodeArrayField -> NodeArrayItem`.
4. Switch nested array `+` actions in `NodeArrayItem` to open insert-position dialog instead of direct append.

## Implementation Summary
- Updated `layers/content/app/components/builder/node-editor/composables/useNodeEditorDialogs.ts`:
  - Added nested insert dialog state/context for:
    - array-item `stringarray`
    - nested `jsonarray`
    - nested `stringarray` inside nested `jsonarray`
  - Added `getNestedInsertPositions()` preview generation and `handleNestedInsertAt(index)`.
  - Insert-at-position is implemented via existing append + move helpers (no new persistence path).
- Updated `layers/content/app/components/builder/NodeEditor.vue`:
  - Wired new composable APIs and add helpers.
  - Rendered a second `NodeInsertDialog` for nested insert contexts.
  - Passed nested insert dialog handlers down to `NodePropsPanel`.
- Updated `layers/content/app/components/builder/node-editor/NodePropsPanel.vue` and `NodeArrayField.vue`:
  - Added pass-through props for nested insert dialog handlers.
- Updated `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`:
  - Nested `+` actions now open insert-position dialog for:
    - array-item `stringarray`
    - nested `jsonarray`
    - nested `stringarray` inside nested `jsonarray`

## Validation
- Attempted: `bunx vitest --config layers/vitest.config.ts layers/content/tests/builder/node-editor-dialogs.spec.ts`
- Result: failed before tests execute due to missing setup module in workspace:
  - `_tests/setup/content.ts`

## Proposed Next Steps
1. Manually verify nested insert dialog behavior in builder for `Phil` arrays and one additional component using nested arrays.
2. If desired, add/repair test setup path for the content layer vitest config so dialog behavior can be covered by automated tests.
