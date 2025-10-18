## Initial Prompt
The :heading prop is rendered as a text field with the value "{"lead":"Meet The","highlight":"Live Promo Totem"}" inside the content editor. Propose changes to the editing interface to support json objects in a more friendly way, with each key having its own field. Present the implementation plan before proceeding.

## Implementation Summary
Implementation Summary: Added generator support for typed object props, introduced a jsonobject editor in the content builder, and converted the Pacanele landing content document to store structured objects instead of encoded strings.

## Documentation Overview
- The component registry generator (`cli-content/generate-component-registry.mjs`) now inspects typed object props and emits a new `jsonobject` control alongside per-field metadata, so builder clients know how to render each key.
- `NodeEditor.vue` in the content layer recognises the `jsonobject` control and renders nested inputs (text, boolean, select, number) for each field, whilst still persisting the underlying values as colon-prefixed JSON strings to remain compatible with existing CouchDB documents.
- Existing pages remain compatible: untyped JSON props still fall back to the raw textarea, and colon-prefixed storage keys continue to be used for JSON-based arrays and objects.
- Builders benefit from the same validation helpers used by array editing, ensuring type-safe casting for booleans and numbers while respecting per-field defaults.

## Implementation Examples
- **schema output with fields**
  ```ts
  // apps/pacanele-landing/content-builder/component-definitions.ts
  {
    key: 'heading',
    label: 'Heading',
    type: 'jsonobject',
    fields: [
      { key: 'highlight', label: 'Highlight', type: 'text' },
      { key: 'lead', label: 'Lead', type: 'text' }
    ]
  }
  ```
- **object draft handling in the builder**
  ```ts
  // layers/content/app/components/builder/NodeEditor.vue
  if (schema?.type === 'jsonobject') {
    propDraft[key] = buildObjectDraft(schema, value)
    objectFieldErrors[key] = {}
  }
  ```
- **friendly editing template branch**
  ```vue
  <template v-else-if="prop.type === 'jsonobject' && (prop.fields?.length)">
    <label v-for="field in prop.fields" class="node-panel__field node-panel__field--nested">
      <span>{{ field.label }}</span>
      <input
        v-model="propDraft[prop.key][field.key]"
        type="text"
        @change="() => handleObjectFieldChange(prop.key, field, propDraft[prop.key][field.key])"
      />
    </label>
  </template>
  ```
