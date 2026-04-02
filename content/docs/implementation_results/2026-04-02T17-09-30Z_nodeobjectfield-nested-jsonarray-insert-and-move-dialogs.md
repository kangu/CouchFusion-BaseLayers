# Initial Prompt
When I add a new item into an array of JSON object entries, I want to see the initial dialogue that asks for the position of where the item should be added, similar to a simple array from the content layer. Again, similar to simple arrays, I want to be able to move different elements of the array to certain positions.  Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

Follow-up scope decision:
- Proceed with step 1 only for now.

## Plan
1. Keep scope limited to `NodeObjectField.vue` (nested jsonarray inside jsonobject path) for minimal impact.
2. Replace nested jsonarray `+` append behavior with an insertion-position dialog.
3. Add per-item `Move (#N)` action and wire reorder-by-position dialog for the same nested jsonarray entries.
4. Leave other array editors (`NodeArrayItem.vue`, top-level `NodeEditor.vue`) unchanged.

## Implementation Summary
- Updated `layers/content/app/components/builder/node-editor/NodeObjectField.vue`.
- For nested `jsonarray` fields in `NodeObjectField`:
  - `+` now opens a "Select insertion point" dialog instead of immediately appending.
  - Added insertion helpers to preview boundaries and insert at selected index.
  - Added a `Move (#N)` action beside `Remove item`.
  - Added reorder dialog wiring and splice-based reordering logic.
- Reused existing shared dialog styling/classes and existing `NodeReorderDialog` component to minimize UI/CSS impact.
- No changes were made to `NodeArrayItem.vue` or `NodeEditor.vue` in this step.

## Validation
- Attempted: `bunx vitest --config layers/vitest.config.ts layers/content/tests/builder/node-editor-dialogs.spec.ts`
- Result: failed before running tests due to missing setup module in current workspace (`_tests/setup/content.ts`), so no automated verification was completed.

## Proposed Next Steps
1. Manually verify in builder with a nested `jsonarray` field (e.g. `signalSection.items`): add at position start/middle/end, then move entries.
2. If you approve broader scope later, apply the same insertion-position dialog behavior to nested arrays rendered in `NodeArrayItem.vue`.
