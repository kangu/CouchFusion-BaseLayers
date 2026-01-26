## Initial Prompt
Use an embedded svg icon inside the search field. Give it a highlight when it has content to draw attention that data below is being filtered.

## Plan
1. Embed a search icon within the admin workbench’s builder search input.
2. Add visual highlight when the search query is non-empty to signal active filtering.

## Implementation Summary
- Updated the header search in `ContentAdminWorkbench.vue` to include an inline SVG icon and apply an active state when the query has content, changing border/box shadow and icon color.
- Input padding adjusted to accommodate the icon without shifting layout.

## Next Steps
- Smoke test: type a query and confirm the input highlights and filtering still works. Remove text to ensure the highlight clears.
