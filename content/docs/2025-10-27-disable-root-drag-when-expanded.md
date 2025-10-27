# Expanded Nodes Disable Root Drag

## Initial Prompt
When a node from the node editor is expanded, make sure to remove the drag support for the outer element. Make sure inside dragging of list elements is still working.

## Implementation Summary
Tracked NodeEditor expansion state and disabled root-level dragging while panels are open, without affecting the existing array item drag-and-drop interactions.

## Documentation Overview
- NodeEditor now notifies consumers when a panel expands or collapses; the Workbench records this for root nodes only.
- The `builder-root-item` container toggles its `draggable` attribute and drag handlers when the associated node is expanded, preventing accidental rearrange operations during editing.
- Nested list reordering continues to function because array-item drag logic lives within NodeEditor and remains untouched.

## Implementation Examples
- Expanding any component in the builder locks the outer drag handle (no drag cursor, dragstart ignored) until the panel is collapsed again.
- Dragging JSON/string array items inside the expanded panel still works thanks to the dedicated array drag handlers.
