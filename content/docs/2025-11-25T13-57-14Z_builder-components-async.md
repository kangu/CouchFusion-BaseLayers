# Initial Prompt
Investigate why ./node_modules/.cache/nuxt/.nuxt/dist/client/_nuxt/DdbvkYOP.js is still over 300kb

# Implementation Summary
Shifted global content-builder/admin components to async registration so their heavy editor/builder code no longer inflates the main client chunk; they now load only when used on builder/admin routes.

# Documentation Overview
- `app/plugins/register-builder.ts` (content layer): removed eager imports of builder/admin components and replaced with `defineAsyncComponent` registrations that dynamically import the workbench, admin workbench, image field, and rich text field, reducing the main bundle weight.

# Implementation Examples
- Async registration:
  ```ts
  const components = {
    BuilderWorkbench: () => import("../components/builder/Workbench.vue"),
    ContentAdminWorkbench: () => import("../components/admin/ContentAdminWorkbench.vue"),
    ContentImageField: () => import("../components/admin/ContentImageField.vue"),
    ContentRichTextField: () => import("../components/admin/ContentRichTextField.vue"),
  };

  for (const [name, loader] of Object.entries(components)) {
    vueApp.component(name, defineAsyncComponent(loader));
  }
  ```

# Next Steps
- Rebuild and verify `_nuxt/DdbvkYOP.js` shrinks as builder/admin components move to their own chunks. If still large, further split NodeEditor or other admin-only modules to lazy chunks.***
