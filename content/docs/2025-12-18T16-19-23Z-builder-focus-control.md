## Initial Prompt
Expose a “focus preview” control in the node header to trigger highlighting.  
Refactor so along with focusing the element on screen, the target element also gets a pronounced inner shadow flashing to signal the element. when the node is expanded, the shadow is to stay permanent. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Added a focus preview control that now supports both flashing and persistent inner-shadow highlights: clicking the focus button flashes the target element in the preview iframe, and expanding a node locks the inner shadow until the node is collapsed, all via the existing builder → iframe messaging pipeline with preview-only UID markers.

## Documentation Overview
- Preview documents are annotated with `data-builder-uid`, and focus messages now carry a `mode` (`flash`, `lock`, `clear`).
- NodeEditor emits `flash` on the focus button and `lock/clear` on expand/collapse; Workbench forwards the mode.
- InlineLiveEditor passes mode to the iframe; inline preview pages apply an inset shadow for flash (short-lived) or lock (persistent) and keep the origin-filtered overlay behavior.
- Highlight logic lives in `useContentLiveUpdates.ts`, adding minimal inline styles for the shadow and reusing the overlay outline for visibility.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue`: focus button sends `mode: flash`; expand sends `mode: lock`; collapse sends `mode: clear`.
- `layers/content/app/components/builder/Workbench.vue`: forwards mode with uid/path in `node-focus` emits.
- `layers/content/app/components/inline/InlineLiveEditor.vue`: includes mode in `builder_focus` postMessage and preserves pending focus with mode.
- `layers/content/app/composables/useContentLiveUpdates.ts`: in preview mode, applies inset shadow classes (`flash` temporary, `lock` persistent) to `[data-builder-uid]` targets and still scrolls into view.
