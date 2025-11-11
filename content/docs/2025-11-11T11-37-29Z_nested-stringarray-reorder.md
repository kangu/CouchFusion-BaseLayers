# Nested Stringarray Reorder

## Initial Prompt
For 3rd level nested items, the drag and drop system doesn't work. Provide an quick easy solution to set from any of the array elements the index where it should be. Like a little link with the {currentIndex}, and when clicking on it, it should ask for a new index, then on confirmation it should splice that elements at the new index. Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions. (UI note: show a nice dialog similar to the insert-items view.)

## Implementation Summary
Added a modal-style reorder control to third-level stringarray entries so authors can type a destination index, backed by helper logic that splices the option into place without relying on drag-and-drop.

## Documentation Overview
- Nested stringarray labels now expose a `Move (#)` link that launches a compact dialog styled like the existing insert overlay, keeping the UX consistent.
- The dialog persists the selected indices in a dedicated reactive store and validates/clamps the requested position before issuing the move.
- Reordering reuses new helper utilities so values stay serialized through `commitPropChange`, preventing regressions elsewhere in the builder.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:1173` – inserts the `Move (#)` trigger and attaches it to the reorder dialog opener inside third-level `stringarray` templates.
- `layers/content/app/components/builder/NodeEditor.vue:3586` – new dialog state/handlers coordinate opening, closing, and confirmation flows.
- `layers/content/app/components/builder/NodeEditor.vue:2684` – helper `moveNestedArrayItemStringArrayItem` splices nested options into the requested index before persisting.
