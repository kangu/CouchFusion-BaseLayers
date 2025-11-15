# Initial Prompt
The click handler for the rich text editor has gone crazy again. There's probably some dragging functionality on top of the tip tap component and something goes wrong with the handlers. Whenever I click on the textarea, I get the Bold toggled. We had this issue before when initially integrating tiptap, check the documentation and apply fixes based on knowledge from there.

# Implementation Summary
Hardened the builder’s custom field wrappers and the `ContentRichTextField` surface so pointer events are absorbed before they reach toolbar buttons—reinstating the documented `@mousedown/@click` guards that prevent inadvertent bold toggles when editing rich text.

# Documentation Overview
- Added reusable wrapper listeners inside `NodeEditor.vue` so any prop using a custom UI component (like the Tiptap editor) automatically stops pointer events at the group container, avoiding label-style activation side effects even after future refactors.
- Restored the `@mousedown.stop.prevent` and `@click.stop.prevent` guards on the root `.rich-text-field` element to ensure clicks within the editor never bubble up to the toolbar controls.

# Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue`
  ```vue
  <component
    :is="fieldWrapperTag(prop)"
    :role="fieldWrapperRole(prop)"
    v-on="fieldWrapperListeners(prop)"
  >
    <component v-if="prop.ui?.component" :is="prop.ui.component" />
  </component>
  ```
- `layers/content/app/components/admin/ContentRichTextField.vue`
  ```vue
  <div
    class="rich-text-field"
    @mousedown.stop.prevent="absorbPointerEvent"
    @click.stop.prevent="absorbPointerEvent"
  >
    <EditorContent class="rich-text-field__content" :editor="editor" />
  </div>
  ```
