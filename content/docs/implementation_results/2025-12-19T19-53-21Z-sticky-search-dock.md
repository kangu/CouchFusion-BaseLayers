# Initial Prompt
Make the search component stay docked at the top (under the other docked panel) while the list of components is scrolling (most likely very long). Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

# Implementation Summary
Moved the builder search bar into the component list container, made it sticky with a configurable scroll height for the list, and updated the spec checklist.

# Documentation Overview
- Repositioned the builder search UI inside the component list and added sticky styling plus a scrollable max-height in `layers/content/app/components/builder/Workbench.vue`.
- Recorded the sticky search completion in `layers/content/docs/specs/search_in_node_editor.md`.

# Implementation Examples
- `layers/content/app/components/builder/Workbench.vue`: `builder-tree__search` now uses `position: sticky` and the list container caps height via `--builder-tree-max-height`.
