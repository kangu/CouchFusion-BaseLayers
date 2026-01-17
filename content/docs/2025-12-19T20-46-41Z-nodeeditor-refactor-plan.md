# NodeEditor Refactor Plan

## Goal
Reduce the size and complexity of `NodeEditor.vue` by extracting focused subcomponents and a small set of composables, while preserving behavior and styling.

## Proposed Component Breakdown
- `NodeEditor.vue` (container + state)
  - Owns draft state, registry lookup, array drag/drop, insert/reorder dialogs, and passes handlers down.
- `NodePanelHeader.vue`
  - Renders component header, action buttons, and collapse toggles.
- `NodePropsPanel.vue`
  - Renders main prop list + extra props, delegates field rendering.
- `NodeField.vue` (generic field wrapper)
  - Handles label, error, match outline, and chooses the correct field control.
- `NodeTextField.vue` / `NodeTextareaField.vue` (inputs)
  - Handles highlight overlays and scroll sync.
- `NodeSelectField.vue`
  - Renders select fields and applies match outline when selected value matches search.
- `NodeBooleanField.vue`
  - Wraps checkbox rendering.
- `NodeArrayField.vue`
  - Renders `jsonarray` / `stringarray` containers, item headers, and delegates item fields.
- `NodeArrayItem.vue`
  - Renders array item fields, reorder/drag handle, and nested arrays.
- `NodeObjectField.vue`
  - Handles `jsonobject` (both structured fields and raw JSON fallback).
- `NodeChildrenPanel.vue`
  - Handles child node list + “add child” controls, recursively renders `NodeEditor`.
- `NodeMarginsPanel.vue`
  - Renders margin controls and responsive overrides.
- `NodeInsertDialog.vue` + `NodeReorderDialog.vue`
  - Encapsulates modal UIs for array insertion/reordering.

## Suggested Composables
- `useNodeEditorSearchHighlight.ts`
  - `shouldHighlightText`, `getHighlightMarkup`, `shouldHighlightSelect`, `syncHighlightScroll`.
- `useNodeEditorFieldVisibility.ts`
  - `isFieldVisible`, `filterVisibleFields`.
- `useNodeEditorArrayDnd.ts`
  - Drag/drop state and handlers for array items.

## Implementation Sequence
1. ✅ Extract highlight/visibility helpers into composables and update `NodeEditor.vue` to use them.
2. ✅ Create `NodeTextField.vue` and `NodeTextareaField.vue` and replace inline input markup in one location first (top-level props + extra props).
3. ✅ Create `NodeField.vue` wrapper to unify label, error, and select match outline.
4. ✅ Extract `NodePropsPanel.vue` to render top-level props + extra props using `NodeField`.
5. ✅ Extract `NodeArrayField.vue` and `NodeArrayItem.vue` for `jsonarray`/`stringarray` (including nested arrays).
6. ✅ Extract `NodeObjectField.vue` for `jsonobject` (structured + JSON fallback).
7. ✅ Extract `NodeChildrenPanel.vue`, keeping recursion on `NodeEditor` intact.
8. ✅ Extract `NodeMarginsPanel.vue` and dialog components.
9. ✅ Move any remaining inline styles or helpers into the appropriate component/composable; keep CSS class names stable to avoid regressions.
10. ✅ Extract dialog state/handlers into `useNodeEditorDialogs`.

## Styling Strategy
- Keep existing class names to avoid behavior changes.
- Option A (minimal change): keep styles in `NodeEditor.vue` and use `:deep()` for child component selectors.
- Option B: move scoped styles into each new subcomponent and keep class names identical.

## Verification Checklist
- Props render correctly across all types (text, textarea, json, jsonobject, jsonarray, stringarray, select, boolean, number).
- Search filtering and highlight overlays still work in nested arrays and object fields.
- Drag/drop reorder works for top-level arrays and nested arrays.
- Insert/reorder dialogs still open and apply changes correctly.
- Text nodes and slot templates remain editable.

## Decisions
- Keep styles centralized in `NodeEditor.vue` and use `:deep()` selectors for child components.
- Deliver the refactor as a series of PRs.
- Create a `layers/content/app/components/builder/node-editor/` subfolder for new subcomponents.

## Phase 1 (PR1) Proposed Scope
- ✅ Create the `builder/node-editor/` subfolder and move any new subcomponents there.
- ✅ Extract highlight + visibility helpers into composables and wire `NodeEditor.vue` to use them.
- ✅ Introduce `NodeTextField.vue` + `NodeTextareaField.vue` and replace top-level prop + extra prop field rendering first.
- ✅ Keep nested array/object field rendering inline for now to minimize risk.

## Open Questions
- Preferred location for new composables: `layers/content/app/composables/` or `layers/content/app/components/builder/node-editor/composables/`?

Preffered location is `layers/content/app/components/builder/node-editor/composables/` as the composables are
only accessed in the local context and are not needed on the outside.

## Testing

Make sure to have tests that cover the standard scenarios that might fail because of the refactor.
