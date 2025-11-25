# Initial Prompt
Proceed with your proposal for lazy-loading the editor/admin/Tiptap areas and splitting the public vs members layouts.

# Implementation Summary
Lazy-loaded the content admin rich-text editor’s Tiptap stack so heavy editor dependencies are pulled only when the admin/builder UI mounts, reducing what lands in the main client bundle on initial load.

# Documentation Overview
- `app/components/admin/ContentRichTextField.vue` (content layer): switched to dynamic imports for `@tiptap/vue-3` and `@tiptap/starter-kit`, instantiating the editor only after the modules load on the client. The editor component now renders via a dynamically loaded `EditorContent` and keeps the same toolbar/behaviour, but the heavy editor libraries no longer inflate the main entry chunk.

# Implementation Examples
- Dynamic module load and editor init:
  ```ts
  const [{ EditorContent, useEditor }, { default: StarterKit }] = await Promise.all([
      import("@tiptap/vue-3"),
      import("@tiptap/starter-kit"),
  ]);
  editorModules.value = { EditorContent, useEditor, StarterKit };
  editor.value = mods.useEditor({ ... });
  ```
- Template renders only after the editor module is ready:
  ```vue
  <component
    v-if="EditorContentComponent"
    :is="EditorContentComponent"
    class="rich-text-field__content"
    :editor="editor?.value"
  />
  ```

# Next Steps
- Rebuild and confirm the main client chunk shrinks (Tiptap should move to its own async chunk used only on admin/builder routes). If further reductions are needed, lazy-load other admin-only toolchains (e.g., NodeEditor) and keep marketing/public layouts free of admin imports.***
