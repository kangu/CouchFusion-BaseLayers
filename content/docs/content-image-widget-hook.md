# Content Builder Image Widget Hook

## Initial Prompt
Let components use transformations at render time. Proceed with the plan.

## Implementation Summary
Implementation Summary: Enabled ImageKit-backed asset selection for the bitvocation content editor by wiring Nuxt runtime config, admin API routes, builder UI hooks, and the ContentImageField widget.

## Documentation Overview
- Extended `ComponentPropSchema` and array field metadata with optional `ui` hints so layer consumers can opt into custom editors without breaking existing builders.
- Updated `NodeEditor.vue` to render dynamic field components when `ui.component` is set, cascading support through nested array editors and emitting normalized updates.
- Added helper callbacks that bridge dynamic widgets back into the builder’s existing `applyProp` / array mutation flows to keep serialization and validation consistent.

## Implementation Examples
- Tag a prop to use a custom widget:
  ```ts
  {
    key: 'image',
    label: 'Image',
    type: 'text',
    ui: { component: 'ContentImageField' }
  }
  ```
- Implement a widget that integrates with the builder:
  ```vue
  <component
    :is="field.ui.component"
    :model-value="item[field.key]"
    :prop-definition="field"
    @update:modelValue="value => handleCustomArrayFieldUpdate(prop.key, index, field, value)"
  />
  ```
