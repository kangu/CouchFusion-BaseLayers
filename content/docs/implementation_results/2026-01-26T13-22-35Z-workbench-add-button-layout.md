## Initial Prompt
Refactor the content layer workbench component to extract the Add Component button from where it is and add it next to the "Search components" controls, like in the provided screenshot.

## Plan
1. Inspect the Workbench builder layout to see how the add button and search controls are currently structured.
2. Move the Add component control alongside the search UI in the tree section and keep supporting dialog/import wiring intact.
3. Tidy the layout/styles so the new cluster aligns horizontally and remains responsive.

## Implementation Summary
- Repositioned the root-level Add component control into the builder tree header next to the search panel, keeping the picker dialog and debug-import input tied to the button.
- Introduced a `builder-tree__controls` layout wrapper and refreshed button styling (rounded, fixed min-width) so the search card and add button sit side by side while wrapping gracefully on smaller widths.

## Next Steps
- Open the builder UI to confirm the new control placement matches the mock and that the ComponentPicker dialog still opens correctly.
- Adjust spacing or sizing further if other panels crowd the header at narrower breakpoints.
