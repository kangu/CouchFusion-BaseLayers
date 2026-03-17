# Initial Prompt
Make the Featured Conferences panel in the admin start collapsed with showing how many are setup. Then clicking on it expands/toggles its visibility state.

# Plan
1. Add local UI state for featured panel expanded/collapsed mode.
2. Default the panel to collapsed.
3. Add a compact header showing the number of configured featured conferences.
4. Toggle full panel content visibility when header is clicked.
5. Keep all existing featured-management logic unchanged.

# Implementation Summary
- Updated `layers/events/app/pages/admin/events/conferences.vue`:
  - added `featuredSectionExpanded` local state (`false` by default),
  - converted section header into a clickable toggle row,
  - displays configured count using `featuredDraft.length`,
  - added `Expand/Collapse` indicator,
  - wrapped existing detailed featured-management UI in `v-if="featuredSectionExpanded"`.
- Existing functionality remains unchanged when expanded:
  - add/remove featured entries,
  - enable/disable toggles,
  - drag-and-drop ordering,
  - image upload/clear,
  - save action.

# Next Steps
1. Reload `/admin/events/conferences` and verify section is collapsed by default.
2. Click header to expand/collapse and confirm configured count is visible when collapsed.
