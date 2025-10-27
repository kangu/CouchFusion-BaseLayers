# Clone Option – Node Workbench

## Initial Prompt
Update the "content" module and the node builder workbench to include a "Clone" option, alongside "Expand" and "Remove", which should insert an identical clone right after the given element (after a short confirmation). Make sure the change works in the /builder inline system.

## Implementation Summary
Added a clone workflow to the content builder, generating fresh UIDs and inserting duplicated nodes after confirmation for both component and text blocks across workbench and inline editors.

## Documentation Overview
- Added a `cloneNode` workflow in `BuilderWorkbench.vue` that deep-clones nodes, regenerates unique identifiers, and injects the duplicate immediately after the source entry.
- Updated `NodeEditor.vue` to surface a Clone action next to the existing Expand and Remove controls for both component and text nodes, delegating to the shared handler.
- Inline builder flows reuse `BuilderWorkbench`, so the new cloning behaviour is automatically available in `/builder` inline editors with the same confirmation gate.

## Implementation Examples
- Clone any block from the builder sidebar; confirm the prompt to insert a duplicate directly beneath the original, including nested children and margins.
- Component markup remains unchanged—`<NodeEditor>` now receives an `onClone` callback and renders a Clone button alongside the existing controls.
