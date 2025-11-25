# Initial Prompt
The rich text editor doesn't render anymore, fix it. (Follow-up: scope builder/admin registration to avoid loading on the homepage while keeping the editor functional.)

# Implementation Summary
Restored builder/admin component availability by conditionally registering them via the content-layer plugin when navigating to builder/admin routes (`/builder`, `/k`, `/admin`), keeping heavy bundles off public pages while ensuring the rich text editor and workbench render on relevant routes.

# Documentation Overview
- `app/plugins/register-builder.ts`: Now conditionally registers `BuilderWorkbench`, `ContentAdminWorkbench`, `ContentImageField`, and `ContentRichTextField` using `defineAsyncComponent` when the current or upcoming route matches builder/admin paths; no registration occurs on public pages.
- Related async imports in the inline editor/admin workbench remain in place to keep the builder code out of the public shell until needed.

# Implementation Examples
- Conditional registration:
  ```ts
  const isBuilderRoute = (path: string) =>
    path.startsWith("/builder") || path.startsWith("/k") || path.startsWith("/admin");

  if (isBuilderRoute(route.path || "/")) registerComponents();
  router.beforeResolve((to) => {
    if (!registered && isBuilderRoute(to.path || "/")) registerComponents();
  });
  ```

# Next Steps
- Rebuild production and verify the rich text editor renders on builder/admin routes while the builder chunk no longer loads on the homepage. If further chunk splitting is needed, lazy-load NodeEditor internals.***
