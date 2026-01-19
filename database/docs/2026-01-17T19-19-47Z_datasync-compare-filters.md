## Initial Prompt
In the area where you show the number of items, like Local only: 26 · Remote only: 19 · Same rev: 6 · Different rev: 4, show checkboxes next to each category and show/hide them based on what is selected

## Implementation Summary
Implementation Summary: Added checkbox filters for each comparison status and wired the document list to hide/show entries based on selected categories.

## Documentation Overview
- Compare Docs header now includes selectable status filters with counts.
- Comparison table respects the selected filters.

## Implementation Examples
```vue
<input v-model="compareStatusFilters" type="checkbox" value="local-only" />
```
