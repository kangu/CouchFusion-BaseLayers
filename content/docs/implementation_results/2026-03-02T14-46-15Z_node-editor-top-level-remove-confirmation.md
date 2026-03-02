# NodeEditor top-level section remove confirmation

## Summary
Added a confirmation prompt when removing top-level nodes (sections) from the node editor.

## Changes
- Updated `layers/content/app/components/builder/NodeEditor.vue`.
- Introduced `requestRemoveNode(uid)` and wired remove buttons to it.
- `requestRemoveNode` behavior:
  - If editor depth is `0`, asks for confirmation with `window.confirm` before removal.
  - If user cancels, removal is aborted.
  - If confirmed (or depth is not `0`), calls existing `onRemove(uid)` handler.

## Result
Removing root sections from the node editor now requires explicit confirmation, reducing accidental top-level deletions.
