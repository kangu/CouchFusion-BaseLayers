# Nested Jsonobject Array UI

## Initial Prompt
The scale is now "jsonobject", but the child fields have not been captured under the "fields" array. Make sure that jsonobject instances are correctly rendered inside nested arrays (level 2 this case).

## Implementation Summary
NodeEditor now renders jsonobject fields within array items using nested form controls, supported by helpers that normalize/store nested objects and route updates through array-aware committers.

## Documentation Overview
- Added object-aware normalization helpers plus type guards so array schemas containing `jsonobject` entries hydrate with the right structure.
- Extended the array-item template to display nested object fields (textarea, boolean, number, select, custom inputs), mirroring the existing jsonobject UI used for top-level props.
- Reused the reorder/action toolbar styling so Move/Remove links remain consistent even when object editors appear inside nested arrays.

## Implementation Examples
- `layers/content/app/types/builder.ts:23-52` – introduced `ComponentArrayObjectField` and updated the array-field union to carry optional `fields` metadata.
- `layers/content/app/components/builder/NodeEditor.vue:2460-2930` – new helpers (`isObjectField`, `getArrayItemObjectValue`, `handleArrayItemObjectFieldChange`, etc.) keep nested objects normalized while reusing existing commit logic.
- `layers/content/app/components/builder/NodeEditor.vue:600-910` – array-item template now includes a jsonobject branch that renders child controls instead of falling back to `[object Object]` text inputs.
