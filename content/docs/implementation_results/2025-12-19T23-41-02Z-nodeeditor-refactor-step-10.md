# Nodeeditor Refactor Step 10

## Initial Prompt
Proceed with step 4. Make sure functionallity still works? Is that covered by the current tests? Add new tests if needed.

## Implementation Summary
- Added `useNodeEditorDialogs` composable to encapsulate insert/reorder dialog state and handlers, keeping array operations injected from `NodeEditor.vue`.
- Refactored `NodeEditor.vue` to use the composable and removed inline dialog state/functions while preserving UI bindings.
- Added composable unit tests for insert positions, insert actions, and reorder contexts; verified `bunx vitest` passes.
- Updated the refactor plan checklist with the new step.

## Documentation Overview
- `useNodeEditorDialogs` owns insert/reorder dialog state and logic while delegating array mutations and helpers to injected callbacks.
- `NodeEditor.vue` now sources dialog state/handlers from the composable to reduce script size without changing behavior.
- New composable tests cover JSON array insert previews, string array insertions, and reorder confirmations for each dialog context.

## Implementation Examples
```ts
const {
    insertDialog,
    reorderDialog,
    openInsertDialog,
    getInsertPositions,
    handleInsertAt,
    openTopLevelArrayReorderDialog,
    openArrayItemStringArrayReorderDialog,
    openNestedJsonArrayReorderDialog,
    openNestedStringArrayReorderDialog,
    closeReorderDialog,
    confirmReorderDialog,
} = useNodeEditorDialogs({
    propDraft,
    collapsedArrays,
    ensureArrayValue,
    ensureStringArray,
    createEmptyArrayItem,
    applyArrayProp,
    getArrayItemStringArrayItems,
    getNestedArrayItems,
    getNestedArrayItemStringArrayItems,
    reorderArrayItems,
    moveArrayItemStringArrayItem,
    moveNestedArrayItem,
    moveNestedArrayItemStringArrayItem,
});
```

```ts
const harness = createDialogHarness();
harness.openTopLevelArrayReorderDialog("items", "jsonarray", 0);
harness.reorderDialog.newIndex = 2;
harness.confirmReorderDialog();
expect(harness.reorderArrayItems).toHaveBeenCalledWith(
    "items",
    0,
    1,
    "jsonarray",
);
```
