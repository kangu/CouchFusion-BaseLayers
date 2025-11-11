# Universal Array Move Links

## Initial Prompt
Place the "Move X" label next to the "Remove item" link. Make it available also for 2nd level arrays. Basically, wherever there is a "Remove Item" link, there should be a "Move X" (making sure the move is done correctly depending on the nesting level on which the element sits).

## Implementation Summary
Every array editor (top-level, nested jsonarray, and nested stringarray) now shows a "Move (#)" link beside "Remove item", which opens the same reorder dialog and splices entries to the requested index with helpers that respect each nesting level.

## Documentation Overview
- Added a generic reorder dialog context so top-level arrays, nested jsonarray nodes, and both generations of stringarray fields can reuse the same UI/validation logic.
- Each remove button now sits inside a shared `.node-panel__array-actions` block that also renders the "Move" trigger, keeping controls aligned regardless of depth.
- New helpers (`moveArrayItemStringArrayItem`, `moveNestedArrayItem`) splice entries in place, while the dialog routes actions through the right helper based on context.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:1583` – top-level array items now show both Remove and Move actions, with Move launching the dialog via `openTopLevelArrayReorderDialog`.
- `layers/content/app/components/builder/NodeEditor.vue:1277` – nested stringarray entries inherit the same action bar and hook into `openNestedStringArrayReorderDialog`.
- `layers/content/app/components/builder/NodeEditor.vue:2830` – new helpers `moveArrayItemStringArrayItem` and `moveNestedArrayItem` ensure reordered data is persisted through the existing commit pipeline.
