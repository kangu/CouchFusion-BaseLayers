# Rich Text Toolbar Bubbling Fix

## Initial Prompt
```
When I click anywhere on the .node-panel__field that contains the tiptap rich text editor, the B (bold) buttons seems to be pressed, so it constantly toggle. Even when I click on the textarea below, the bold is still toggled. Investigate and fix
```

## Implementation Summary
Updated the builder so custom UI widgets (like the Tiptap field) render inside a `<div>` wrapper rather than `<label>`, and added `@click.stop.prevent` / `@mousedown.stop.prevent` on the field wrapper itself, preventing ancestor label activation from toggling the bold button when clicking inside the editor surface.

## Documentation Overview
- `layers/content/app/components/builder/NodeEditor.vue` now selects the wrapper tag dynamically, using `<div role="group">` when `prop.ui.component` is provided so browser label activation no longer targets toolbar buttons.
- `layers/content/app/components/admin/ContentRichTextField.vue` adds `@click.stop.prevent` and `@mousedown.stop.prevent` on the root wrapper to further guard against bubbling interactions.

## Implementation Examples
```vue
<component
  v-for="prop in componentDef.props"
  :is="fieldWrapperTag(prop)"  <!-- returns 'div' for custom widgets -->
  :role="fieldWrapperRole(prop)"
  class="node-panel__field"
>
  <span>{{ prop.label }}</span>
  <component v-if="prop.ui?.component" :is="prop.ui.component" ... />
</component>
```
