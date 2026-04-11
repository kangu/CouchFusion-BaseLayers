# Initial Prompt
I want to update the content layer to expose an automatic route in the admin sidebar that would load a /admin/pages endpoint where content pages are displayed and can be handled with a nice UX

# Plan
1. Register a `Content -> Pages` item in `appConfig.adminWorkspace.sections` directly from the content layer so consuming apps get it by default.
2. Add a new content-layer route page at `/admin/pages` and protect it with admin auth middleware.
3. Reuse `ContentAdminWorkbench` as the main UX surface so content pages can be listed/edited/deleted without duplicating logic.
4. Validate generated config and route registration in a consuming app (`nuxt-app-starter`).

# Implementation Summary
- Updated `layers/content/nuxt.config.ts` to contribute admin workspace navigation automatically:
  - Section: `Content`
  - Item: `Pages`
  - Route: `/admin/pages`
  - Icon: `mdi:file-document-multiple-outline`
  - Role guard metadata: `requiresRoles: ['admin']`
- Added `layers/content/app/pages/admin/pages.vue`:
  - Uses `layout: 'admin-workspace'`
  - Uses `middleware: ['auth', 'role-auth']` and `authAllowedRoles: ['admin']`
  - Renders a compact page header and mounts `ContentAdminWorkbench` as the main management UX.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter`.
- Confirmed generated merged app config includes `"label": "Pages"` and `"route": "/admin/pages"` in `.nuxt/app.config.mjs`.
- Browser check on `http://localhost:6018/admin/pages` still returns the old catch-all 404 from the currently running dev process, indicating route graph hot state is stale and needs a dev restart.

# Next Steps
1. Restart the active `nuxt-app-starter` dev server process.
2. Re-open `/admin/pages` and verify the sidebar shows `Content > Pages` automatically and the workbench renders.
3. Optionally add a direct shortcut from `/admin` dashboard cards to `/admin/pages` in starter apps.
