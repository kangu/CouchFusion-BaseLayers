# Initial Prompt
The content module allow for adding Paragraph elements. Update the element to allow for text alignment options, with values "left", "center" and "right", which would translate to CSS text-align properties. Present the implementation plan before doing anything

# Implementation Summary
Added an alignment select to the paragraph builder node and wired serialization/deserialization so align values emit proper text-align styles while round-tripping cleanly through the builder and runtime output.

# Documentation Overview
- Paragraph nodes in the content builder now expose an `Alignment` select with `left`, `center`, and `right` options (defaulting to `left`).
- When content is saved, the selected alignment is converted into a `text-align` style on the rendered `<p>` tag; left-aligned paragraphs omit the style entirely.
- Loading existing content strips any `text-align` style back into the builder alignment control so documents remain editable without duplicating styles.

# Implementation Examples
- `layers/content/app/composables/useComponentRegistry.ts:14` – registers the paragraph alignment select with defaults and options.
- `layers/content/app/utils/contentBuilder.ts:63` – normalises/removes legacy text-align styles and reapplies the chosen alignment during serialization.
- `layers/content/app/components/builder/Workbench.vue:27` – extracts alignment from saved styles and cleans the builder props when loading existing documents.
