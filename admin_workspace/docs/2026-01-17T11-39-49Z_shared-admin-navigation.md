## Initial Prompt
Implement the specs in docs/specs/shared_admin_pages.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Added the ui_navigation layer with a shared sidebar component/composable, registered the database layer’s admin section and /admin/datasync placeholder, and refactored the Bitvocation members layout to consume the shared navigation with an app-configurable admin layout.

## Documentation Overview
- Added `layers/ui_navigation` with a shared `SidebarNavigation` component and `useSidebarNavigation` composable for building role-aware sections.
- Layer-provided admin sections are read from `appConfig.uiNavigation.sections`, allowing other layers/apps to contribute links.

## Implementation Examples
```ts
// layers/ui_navigation/app/composables/useSidebarNavigation.ts
const { sections } = useSidebarNavigation({
  hasRole: (role) => authStore.hasRole(role),
});
```
```vue
<SidebarNavigation :sections="navigationSections" />
```
