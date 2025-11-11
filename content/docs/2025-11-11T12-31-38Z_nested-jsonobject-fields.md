# Nested Jsonobject Fields

## Initial Prompt
The nested "scale" element within "questions" still shows in the Node Editor "[object Object]". Investigate why and fix. Success scenario means the object fields are rendered whenever a nested object is found.

## Implementation Summary
NodeEditor now detects `jsonobject` schemas inside array items (including second-level nested arrays) and renders their child fields with the same controls used for top-level objects, eliminating the `[object Object]` placeholder.

## Documentation Overview
- Added object-aware helpers plus type guards so array and nested-array editors hydrate `jsonobject` entries, expose their per-field inputs, and persist updates via existing commit flows.
- Extended the array templates to render nested object editors (and fall back to JSON textareas when no `fields` metadata exists), reusing the action toolbar for Move/Remove links.
- Supporting styles ensure the nested object blocks align with the surrounding array UI.

## Implementation Examples
- `layers/content/app/types/builder.ts:35-57` – array item types now include `ComponentArrayObjectField`, allowing schemas like `questions[].scale` to carry nested `fields` metadata.
- `layers/content/app/components/builder/NodeEditor.vue:600-1185` – both top-level and nested array templates gained `jsonobject` branches that render child controls instead of raw `[object Object]` text.
- `layers/content/app/components/builder/NodeEditor.vue:2460-3350` – new helpers (`getArrayItemObjectValue`, `handleNestedArrayItemObjectFieldChange`, etc.) normalize nested objects and funnel edits through `commitPropChange`/`setNestedArrayItems` as needed.
