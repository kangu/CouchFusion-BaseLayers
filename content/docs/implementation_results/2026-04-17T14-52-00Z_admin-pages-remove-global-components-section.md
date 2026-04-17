# Remove Global Components From /admin/pages

## Scope
Removed the Global Components section and all related handling from `layers/content/app/pages/admin/pages.vue`.

## Changes
- Removed global-components imports and runtime state from the page script.
- Removed all global-components draft/load/save handlers.
- Removed `loadGlobalComponentsSettings()` from `onMounted` initialization.
- Removed Global Components UI section from the template.
- Removed global-components-specific CSS styles from the scoped style block.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## File changed
- `layers/content/app/pages/admin/pages.vue`
