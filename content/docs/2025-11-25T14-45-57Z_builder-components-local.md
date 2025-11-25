# Initial Prompt
Remove (or guard) the global registration in layers/content/app/plugins/register-builder.ts. Instead, import the builder/admin components locally in the admin/builder pages with defineAsyncComponent.

# Implementation Summary
Stopped globally registering builder/admin components and now load them locally on the routes that need them via `defineAsyncComponent`, so the heavy builder/admin bundle no longer loads on public pages. The global plugin was removed entirely to keep admin chunks out of the entry bundle.

# Documentation Overview
- `app/plugins/register-builder.ts`: Removed; global builder/admin registration dropped to avoid pulling the builder chunk into the public shell.
- `app/components/inline/InlineLiveEditor.vue`: Loads `ContentAdminWorkbench` via `defineAsyncComponent`, keeping the inline builder self-contained.
- `app/components/admin/ContentAdminWorkbench.vue`: Imports `BuilderWorkbench` via `defineAsyncComponent`, ensuring the builder workbench is scoped to the admin UI only when used.

# Implementation Examples
- No-op plugin (registration removed):
  ```ts
  // Global builder/admin registration removed to avoid loading heavy editor chunks
  // on public routes. Components are now imported locally on the pages that need them.
  export default defineNuxtPlugin(() => {})
  ```
- Local async components:
  ```ts
  const ContentAdminWorkbench = defineAsyncComponent(() =>
    import("#content/app/components/admin/ContentAdminWorkbench.vue")
  )
  const BuilderWorkbench = defineAsyncComponent(
    () => import("../builder/Workbench.vue")
  )
  ```

# Next Steps
- Rebuild production and confirm the builder/admin chunk is no longer requested on the homepage; inspect modulepreloads for any remaining admin/builder assets and consider further splitting NodeEditor if needed.
