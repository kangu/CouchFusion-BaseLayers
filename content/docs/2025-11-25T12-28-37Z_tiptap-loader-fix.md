# Initial Prompt
tiptap is not properly loaded on the richtext editor, check why

# Implementation Summary
Fixed the admin rich-text editor to load Tiptap correctly after the recent lazy-loading changes: dynamic imports now instantiate a concrete `Editor` (not `useEditor`), wire it to `EditorContent` only after modules are ready, and update toolbar/command bindings, restoring the editor display and enabling editing.

# Documentation Overview
- `app/components/admin/ContentRichTextField.vue` (content layer): refactored the lazy-load flow so Tiptap modules populate `editorInstance` reliably, with `EditorContent` rendered via `EditorContentComponent` after the dynamic import; command helpers and toolbar state now reference the resolved editor instance and clean up on unmount.

# Implementation Examples
- Editor creation after dynamic import:
  ```ts
  const [{ EditorContent, Editor }, { default: StarterKit }] = await Promise.all([
    import("@tiptap/vue-3"),
    import("@tiptap/starter-kit"),
  ])
  editorModules.value = { EditorContent, Editor, StarterKit }
  editor.value = new Editor({ ... })
  EditorContentComponent.value = EditorContent
  ```
- Template waits for the module and uses the live instance:
  ```vue
  <component
    v-if="EditorContentComponent"
    :is="EditorContentComponent"
    class="rich-text-field__content"
    :editor="editorInstance"
  />
  ```

# Next Steps
- After rebuild, verify the admin content/builder rich-text field renders and responds to toolbar commands. If further trimming is needed, consider lazy-loading any additional admin-only components that still bundle into the main chunk.***
