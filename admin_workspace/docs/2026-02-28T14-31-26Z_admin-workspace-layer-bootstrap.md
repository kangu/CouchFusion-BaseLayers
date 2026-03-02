# Summary
- Bootstrapped the new `admin_workspace` layer as the shared home for admin navigation/layout primitives.
- Added:
  - `nuxt.config.ts` alias and composable import dir
  - `app/components/SidebarNavigation.vue`
  - `app/composables/useSidebarNavigation.ts`
  - `app/layouts/admin-workspace.vue`

# Compatibility
- `useSidebarNavigation` reads both:
  - `appConfig.adminWorkspace.sections` (new canonical key)
  - `appConfig.uiNavigation.sections` (legacy compatibility key)
- This allows incremental app migrations without breaking current layer contributions.
