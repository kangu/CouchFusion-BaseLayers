# Bullets Section Buttons Definition

## Initial Prompt
We are working on the content layer with the NodeEditor and Workbench, the cli-content/generate-component-registry.mjs tool and the bitvocation-site and its implementation of content. The BulletsSection.vue allows button elements to be defined on the card prop, but this is not covered at all in the builder since the card.buttons have no definition anywhere. Investigate and propose how to transform the file to allow for a proper definition export into component-definitions.ts.

## Implementation Summary
Generated 36 component definitions for bitvocation-demo.

## Documentation Overview
- Added nested-array editing support in the content builder so component authors can configure per-card button lists directly in the UI.
- Extended builder type definitions to distinguish primitive fields, nested jsonarray fields, and string-array fields within array items.
- Enhanced the component registry generator to carry nested array metadata from TypedScript props into generated `component-definitions` entries.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:149` – renders nested array editors for jsonarray fields like `card.buttons` with add/remove flows.
- `layers/content/app/types/builder.ts:19` – defines discriminated unions for array item fields, including nested jsonarray metadata.
- `cli-content/generate-component-registry.mjs:605` – converts inferred nested array schemas into builder-ready metadata for registry generation.
