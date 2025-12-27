The margins section of the node editor for each element starts with no values set, like the attached screenshot
at content/docs/specs/margins_for_node.png.

## Status
- [x] Collapse margins controls by default and add a double-arrow toggle on the label.
- [x] Hide responsive override/reset actions when the section is collapsed.
- [x] Highlight the "Margins" label whenever any base or responsive margin value is set.

Refactor so that all components except the Margins label are hidden by default, and on the right side of the text there is a double-arrrow down icon symbolizing you can click to expand the margins section.

When any kind of margin is set of an element (either main top/right/bottom/left), or a responsive override, the "Margins" label is to be highlighted so it's clear something is set.
