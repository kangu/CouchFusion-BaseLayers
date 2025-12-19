# Search in Node Editor

## Requirements
- Implement a fuzzy search feature in the node editor component.
- The search input is to be placed at the top of the list of components, and the search filter should be applied to the entire list of components.
- When a props value does not match the search query, it should be hidden from the list.
- Make sure the search is applied at all the available levels of a component tree, including nested components and those using the jsonarray or jsonobject value types.

## Progress
- [x] Add the search input above the component list and wire the query into the builder UI.
- [x] Filter component tree nodes (root + nested) based on prop/text matches.
- [x] Filter prop fields and array/object entries by search value (jsonarray/jsonobject/stringarray).
- [x] Filter extra props and text nodes as part of the search scope.
- [x] Keep the search input sticky above the scrollable component list.
- [x] Highlight matching text in inputs/textarea and flag matching select fields.
