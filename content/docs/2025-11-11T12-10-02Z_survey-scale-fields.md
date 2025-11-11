# Survey Scale Fields

## Initial Prompt
The scale is now "jsonobject", but the child fields have not been captured under the "fields" array. Check to see if the problem is because the scale interface is defined inline under SurveyComponentQuestionProp. Investigate extracting it in a separate interface/type for cleaner discovery by cli-content/generate-component-registry.mjs

## Implementation Summary
Fixed the generator so nested object items reuse either `fields` or `items` metadata, allowing inline object literals like `question.scale` to emit their child fields without restructuring the component types.

## Documentation Overview
- Updated `convertArrayItemSchema` to populate `jsonobject.fields` from whichever property (`fields` or `items`) the analyzer filled, covering inline literals inside arrays.
- Regenerated the bitvocation component registry so SurveyForm questions now expose `scale.min`, `scale.max`, `scale.minLabel`, and `scale.maxLabel` inputs.
- No type extraction was necessary; the existing inline definition works once the generator reads the stored `fields` array.

## Implementation Examples
- `cli-content/generate-component-registry.mjs:826-835` – new fallback grabs `item.fields || item.items` before converting nested child schemas.
- `apps/bitvocation/app/content-builder/component-definitions.ts:1240-1305` – `questions[].scale` now lists all four scale fields under `fields`, giving editors full control in the builder.
