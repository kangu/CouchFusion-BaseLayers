## Initial Prompt
Implement the specs in docs/specs/shared_admin_pages.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Added the ui_navigation layer with a shared sidebar component/composable, registered the database layer’s admin section and /admin/datasync placeholder, and refactored the Bitvocation members layout to consume the shared navigation with an app-configurable admin layout.

## Documentation Overview
- `layers/database/nuxt.config.ts` now contributes a Database admin section with a “Data Sync” link via `appConfig.uiNavigation.sections`.
- Added a `/admin/datasync` page in the database layer that uses `admin-auth` and resolves its layout from `appConfig.uiNavigation.adminLayout`.

## Implementation Examples
```ts
// layers/database/nuxt.config.ts
appConfig: {
  uiNavigation: {
    sections: [
      {
        id: 'database',
        title: 'Database',
        requiresRoles: ['admin'],
        items: [
          { label: 'Data Sync', route: '/admin/datasync', icon: 'mdi:database-sync' },
        ],
      },
    ],
  },
},
```
```vue
<!-- layers/database/pages/admin/datasync.vue -->
<script setup lang="ts">
const appConfig = useAppConfig()
const adminLayout = computed(() => appConfig.uiNavigation?.adminLayout || 'default')
setPageLayout(adminLayout.value)
</script>
```
