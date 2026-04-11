# Initial Prompt
Implement sorting at the table column level and remove from filters. Page size count should be sitting inside the pagination area.

# Plan
1. Remove sort controls from the top filter toolbar.
2. Add sortable table headers for `Path`, `Title`, and `Updated`.
3. Keep existing sort state and move interaction to header click toggles.
4. Move page size selector from toolbar into pagination controls.
5. Validate type generation.

# Implementation Summary
- Updated `layers/content/app/pages/admin/pages.vue`:
  - Removed `Sort` and `Direction` selects from the filter toolbar.
  - Added clickable column-header sorting controls:
    - `Path`
    - `Title`
    - `Updated`
  - Added sort direction indicator (`▲` / `▼`) in active sorted column header.
  - Added `toggleColumnSort(...)` and `sortLabel(...)` helpers.
  - Moved `Page Size` selector into the pagination area.
  - Added small supporting styles for `.pages-column-sort` and pagination-level page-size field.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Verify interactively that header clicks toggle sort direction and reset pagination to page 1 as expected.
2. Optionally persist sort state to query params for shareable/admin bookmarkable views.
