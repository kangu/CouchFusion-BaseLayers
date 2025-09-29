# String Array Support

## Initial Prompt
Make sure this type of prop definition type is caught and a proper json array of strings in this case if created. Call this type "stringarray".

description: {
    type: Array,
    required: true,
    validator: (value) => value.every(stat => typeof stat === 'string')
  }

If no validator is to be found on the type: Array definition, assume it's a stringarray. On the node builder interface, provide minimal crud functionality to handle the array values.

## Implementation Summary
Added stringarray support by defaulting array props without validators to string lists and updating the builder UI for CRUD editing of string arrays.

## Documentation Overview
- Builder prop typings gained the `stringarray` control with optional `elementType` metadata, enabling downstream logic to distinguish primitive arrays.
- NodeEditor now renders editable rows for string arrays, including add/remove actions and input bindings that persist through `onUpdateProp`.
- Workbench normalization ensures serialized string arrays hydrate into plain string lists, guaranteeing safe round-tripping of content documents.

## Implementation Examples
- `layers/content/app/types/builder.ts:9` – Prop schema type union now includes `stringarray` plus `elementType` metadata.
- `layers/content/app/components/builder/NodeEditor.vue:70` – New UI controls provide CRUD support for primitive string arrays.
- `layers/content/app/components/builder/Workbench.vue:82` – Hydration step coerces serialized arrays into string lists for editor consumption.
