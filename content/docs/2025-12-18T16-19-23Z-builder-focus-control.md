## Initial Prompt
Expose a “focus preview” control in the node header to trigger highlighting.

## Implementation Summary
Added a “Focus preview” icon button to each NodeEditor header that triggers the existing node-focus messaging, so users can explicitly highlight the corresponding iframe element without changing field focus.

## Documentation Overview
- The node header now includes a crosshair-style button labelled “Focus preview.” Clicking it emits the existing `onFocusNode` hook, which flows through the builder to the inline preview, causing the `[data-builder-uid]` element to scroll into view and show the highlight overlay.
- This reuses the preview-only builder UID markers and focus messaging pipeline introduced earlier; no persistence changes or extra bundles are added.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue`: added the “Focus preview” icon button beside the collapse/clone/remove controls and wired it to `onFocusNode` via `triggerFocus()`.
