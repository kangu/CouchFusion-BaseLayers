# Initial Prompt
After inserting a new item in an array structure, I want to have its first input field focused and brought into view.

## Plan
1. Add insertion-focus signaling to `useNodeEditorDialogs` for top-level and nested array inserts.
2. In `NodeEditor`, consume that signal and reuse existing prop-focus logic so inserted fields are expanded, scrolled into view, and focused.
3. Add the same focus-after-insert behavior to `NodeObjectField` local insert flow.
4. Keep changes minimal by reusing existing selectors and focus utilities.

## Implementation Summary
- Updated `layers/content/app/components/builder/node-editor/composables/useNodeEditorDialogs.ts`:
  - Added `insertFocusRequest` state with tokenized focus path payload.
  - Set focus path after successful top-level inserts (`jsonarray`, `stringarray`).
  - Set focus path after nested inserts (`array-field stringarray`, `nested jsonarray`, `nested stringarray`).
  - Exported `clearInsertFocusRequest()`.
- Updated `layers/content/app/components/builder/NodeEditor.vue`:
  - Added watcher for `insertFocusRequest`.
  - Reused `focusPropInput(...)` to expand relevant arrays, scroll target into view, and focus/select first editable input.
  - Clears focus request after handling.
- Updated `layers/content/app/components/builder/node-editor/NodeObjectField.vue`:
  - After local nested-jsonarray insert, computes inserted field path.
  - On next tick, scrolls inserted field into view and focuses/selects first editable input.

## Validation
- Attempted: `bunx vitest --config layers/vitest.config.ts layers/content/tests/builder/node-editor-dialogs.spec.ts`
- Result: failed before tests execute due to missing setup module in workspace:
  - `_tests/setup/content.ts`

## Proposed Next Steps
1. Manually validate focus behavior for: top-level arrays, nested stringarray, nested jsonarray, and nested stringarray-inside-jsonarray.
2. If desired, add a dedicated UI test for “insert -> auto-focus first field” once test setup path is restored.
