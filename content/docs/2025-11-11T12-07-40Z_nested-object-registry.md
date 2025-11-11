# Nested Object Registry

## Initial Prompt
Inside the "questions" definition, the "scale" key is marked as type="text", but the SurveyForm.vue component on the SurveyComponentQuestionProp type marks the scale as an object. Make the necessary refactorings to the SurveyForm props so the object is recognized correctly by cli-content/generate-component-registry.mjs. Check to see if it's a problem because the value is nested further down into props.

## Implementation Summary
Updated the registry generator so nested object literals (like `question.scale`) emit `jsonobject` controls, then regenerated bitvocation’s component definitions so SurveyForm questions expose a proper Scale object instead of a plain text field.

## Documentation Overview
- `convertArrayItemSchema` now handles `object` items by producing `jsonobject` props with nested `fields`, letting the builder surface deep object shapes without manual overrides.
- Running `cli-content/generate-component-registry.mjs --app=bitvocation` refreshed `app/content-builder/component-definitions.ts`, switching `questions[].scale` to the corrected schema automatically.
- This change benefits any future components that include nested objects within array entries, since the generator now covers that case globally.

## Implementation Examples
- `cli-content/generate-component-registry.mjs:819-870` – new branch maps `item.type === 'object'` to a `jsonobject` schema with recursively converted child fields.
- `apps/bitvocation/app/content-builder/component-definitions.ts:1230-1295` – regenerated SurveyForm definition now lists `scale` as `jsonobject`, ensuring the builder shows its min/max labels.
