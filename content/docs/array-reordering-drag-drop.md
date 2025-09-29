# Array Reordering Drag & Drop

## Initial Prompt
Implement the specs in layers/content/docs/array_reordering.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Enabled drag-and-drop reordering for jsonarray and stringarray props inside the content builder while preserving existing node-level drag behavior.

## Documentation Overview
- Added per-item drag handlers in `NodeEditor` so array entries can be repositioned via HTML5 drag events with visual feedback.
- Persisted mutations through existing `applyProp` calls, stringifying both jsonarray and stringarray payloads so downstream renderers receive the expected data type while the builder works with parsed drafts.
- Guarded drag events with `stopPropagation` on array rows to prevent interference with the existing root-node drag/drop workflow in `Workbench`.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:44` – array item templates now include draggable handles and drop targets with reorder logic.
- `layers/content/app/components/builder/NodeEditor.vue:533` – helper methods manage drag state, reordering, and persistence for jsonarray/stringarray props.
- `layers/content/docs/array_reordering.md:1` – spec updated with completion markers reflecting the new functionality.
