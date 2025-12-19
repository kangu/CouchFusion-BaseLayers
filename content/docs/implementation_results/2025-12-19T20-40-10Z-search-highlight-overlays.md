# Initial Prompt
Is there a way to highlight the found text within the inputs where it is found? Is there a way to scroll to the part of the text (if it's more to the end and not visible from the start).

# Implementation Summary
Added search-driven highlight overlays for text inputs and textareas, outlined select fields (including custom UI selects) when they match, and synced highlight layers for scrollable textareas.

# Documentation Overview
- Added highlight helpers and scroll syncing to the node editor so search matches render as `<mark>` overlays within text inputs/textarea in `layers/content/app/components/builder/NodeEditor.vue`.
- Applied select-match outlines via field wrapper classes to cover native and custom select components in `layers/content/app/components/builder/NodeEditor.vue`.
- Recorded the highlight capability in the search spec checklist at `layers/content/docs/specs/search_in_node_editor.md`.

# Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue`: `shouldHighlightText`, `getHighlightMarkup`, and `syncHighlightScroll` drive overlay markup and keep textarea scrolling aligned.
- `layers/content/app/components/builder/NodeEditor.vue`: `node-panel__input-highlight` styles and `node-panel__field--match` outlines surface matches in text and select controls.
- `layers/content/docs/specs/search_in_node_editor.md`: added a progress item for match highlighting.
