# Initial Prompt
Implement the specs in content/docs/specs/search_in_node_editor.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.

# Implementation Summary
Added a builder search input and query flow, introduced shared search helpers, filtered builder tree nodes by case-insensitive value matches, and applied search-aware filtering to NodeEditor props (including extra props) plus nested jsonarray/jsonobject/stringarray entries and text nodes.

# Documentation Overview
- Added shared search utilities for normalizing queries and matching nested values in `layers/content/app/utils/builderSearch.ts`.
- Wired the Workbench search input to filter visible root nodes and pass the query into nested NodeEditor instances in `layers/content/app/components/builder/Workbench.vue`.
- Updated NodeEditor to filter props, extra props, array items, and nested object/array controls while keeping matching descendants visible in `layers/content/app/components/builder/NodeEditor.vue`.
- Marked spec progress as completed in `layers/content/docs/specs/search_in_node_editor.md`.

# Implementation Examples
- `layers/content/app/utils/builderSearch.ts`: `matchesSearchValue` and `filterNodesBySearch` handle case-insensitive value matching across nested objects/arrays.
- `layers/content/app/components/builder/Workbench.vue`: `filteredBuilderTree` drives the component list with the search query and passes `searchQuery` into NodeEditor.
- `layers/content/app/components/builder/NodeEditor.vue`: `visibleProps`, `filteredExtraPropEntries`, and search-aware array loops control which fields render.
