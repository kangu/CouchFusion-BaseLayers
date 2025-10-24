# Live Preview Debounce

## Initial Prompt
```
For the content module while editing, make sure that live preview is sent to a listening iframe on all types of edits; currently it's working on regular text fields, make it work on @input with slight debounce for: items inside jsonarray elements, items inside jsonobject elements, image selection
```

## Implementation Summary
Extended the builder node editor so json/object-based controls emit debounced updates via `commitPropChange`, ensuring the inline iframe receives live preview messages when editing array/object fields or selecting images.

## Documentation Overview
- Added a generic `commitPropChange` helper that reuses the existing `schedulePropUpdate`/`flushPropUpdate` timers to debounce prop writes.
- Array/object handlers (`handleArrayItemFieldChange`, `handleObjectFieldChange`, nested helpers) now accept an options bag and schedule updates on `@input`, while blur/change events still flush immediately.
- Custom UI components (including image pickers) are wired through the new debounce flow, so selections propagate to live preview without waiting for blur events.

## Implementation Examples
```ts
const handleArrayItemFieldChange = (
  propKey: string,
  index: number,
  field: ComponentArrayItemField,
  rawValue: unknown,
  options: { debounce?: boolean } = {}
) => {
  // ...update draft
  commitPropChange(propKey, next, 'jsonarray', options)
}
```

```vue
<textarea
  v-model="item[field.key]"
  rows="3"
  @input="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key], { debounce: true })"
  @change="() => handleArrayItemFieldChange(prop.key, index, field, item[field.key])"
/>
```

```ts
const handleCustomPropUpdate = (
  schema: ComponentPropSchema,
  value: unknown,
  options: { debounce?: boolean } = {}
) => {
  propDraft[schema.key] = value
  commitPropChange(schema.key, value, schema.type, options)
}
```
