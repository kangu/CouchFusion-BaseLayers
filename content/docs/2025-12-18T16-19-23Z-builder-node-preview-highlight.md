## Initial Prompt
I want to focus on the content layer for the nodeeditor component. I want .node-panel element in a /builder page be able to highlight and focus the associated section rendered in the iframe. Ideally would be cool to be able to draw an outline around the element on the page. Evaluate how would this be possible through the iframe and with minimal overhead for the client bundle. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Added preview-only builder UID markers and focus messaging so selecting a node in the builder highlights the corresponding element in the inline preview iframe, with a lightweight overlay and origin-filtered postMessage flow; saved documents remain unmodified. Updated to support both flashing and persistent inner-shadow highlights tied to focus vs expansion state.

## Documentation Overview
- Builder serialization now supports an optional preview decoration that injects `data-builder-uid` attributes onto rendered nodes; this is used only for live previews, not persisted documents.
- Workbench emits both normal and preview documents plus node-focus events; the inline editor forwards preview documents and focus payloads to the preview iframe.
- Inline preview pages (when `inline-preview=1`) listen for `live_updates` and `builder_focus` messages; the latter queries `[data-builder-uid="<uid>"]`, scrolls it into view, and draws a transient outline overlay to indicate focus.
- Focus events are origin-checked and gated by the inline-preview query flag to keep the runtime overhead minimal on normal page loads.

## Implementation Examples
- `layers/content/app/utils/contentBuilder.ts`: added `annotateBuilderUids` serialize option and wiring so preview documents carry `data-builder-uid` attributes.
- `layers/content/app/components/builder/Workbench.vue`: emits preview documents and node-focus events; preview docs use the new annotation option while saved docs remain clean.
- `layers/content/app/components/inline/InlineLiveEditor.vue`: forwards preview docs and focus payloads to the iframe via `postMessage`, preferring decorated documents for rendering highlights.
- `layers/content/app/composables/useContentLiveUpdates.ts`: handles `builder_focus` messages in inline preview mode, scrolling to and outlining the matching `[data-builder-uid]` element inside the iframe-rendered page.
