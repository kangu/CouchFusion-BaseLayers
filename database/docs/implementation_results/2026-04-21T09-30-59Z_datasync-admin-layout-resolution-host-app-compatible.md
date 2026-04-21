# Initial Prompt
I want to make an update to the database -> data sync menu entry that gets automatically created for admin workspaces. The component is currently setup to work inside the bitvocation project, so it tries to load a layout that doesn't exist. I want to make it so it works integrated with the current admin layout from the implementing project, and then for bitvocation app it works as it does currently.

# Plan
1. Inspect current Data Sync layout resolution path in `layers/database`.
2. Implement layout resolution that prioritizes host app admin layout when available.
3. Preserve existing Bitvocation behavior (`uiNavigation.adminLayout = members`).
4. Validate in both `nuxt-app-starter` and `bitvocation`.

# Implementation Summary
Updated database layer layout resolution module to support host-app admin layout inference while keeping legacy compatibility.

## Code changes
- Updated `layers/database/utils/register-layout.ts`.
- Added helper `extractPageLayout(page)` to safely read page meta layout.
- Added helper `inferHostAdminLayout(pages, layerRoot)` to detect admin layout from non-layer `/admin` pages.
- Updated layout resolution order:
  1. `appConfig.adminWorkspace.layout`
  2. `appConfig.uiNavigation.adminLayout` (legacy; keeps Bitvocation behavior)
  3. inferred host app admin page layout
  4. fallback `'admin-workspace'`

## Behavior result
- Apps using admin workspace without explicit `appConfig.*.layout` now reuse their actual admin page layout when defined on host admin pages.
- Bitvocation remains unchanged because it still resolves through `appConfig.uiNavigation.adminLayout = 'members'`.
- If no explicit or inferred layout exists, database pages now use `'admin-workspace'` as final fallback.

# Validation
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.
- `cd apps/bitvocation && bunx nuxi prepare` passed.

# Next Steps
1. Optional: add a small test around `register-layout` layout resolution precedence (config vs inferred).
2. Optional: align other shared admin pages in other layers to use the same layout resolution strategy for consistency.

## Follow-up fix
After validation in `nuxt-app-starter`, the route still resolved with the wrong layout in some layered route resolution cases.

Adjusted `register-layout` assignment guard to also match `page.path === '/admin/datasync'` (in addition to layer file path check), ensuring the layout meta is always applied to the Data Sync route regardless of file path normalization.

### Re-validation
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.
- `cd apps/bitvocation && bunx nuxi prepare` passed.

## Root cause and final fix
### Root cause
`/admin/datasync` occasionally missed the intended admin layout in layered app resolution, so it rendered in a layout without the sidebar.

### Final fix
Added a runtime layout fallback directly in `layers/database/pages/admin/datasync.vue`:
- read host layout from `useAppConfig()` in this order:
  1) `adminWorkspace.layout`
  2) `uiNavigation.adminLayout`
  3) `'admin-workspace'`
- applied with `setPageLayout(resolvedAdminLayout)`.

This guarantees the Data Sync page uses the host app's admin layout even if build-time route meta injection is not applied as expected.

### Verification
- `cd apps/nuxt-app-starter && bunx nuxi prepare` passed.
- `cd apps/bitvocation && bunx nuxi prepare` passed.
- Browser verification (`dev-browser`) from `/admin/pages` -> `Data Sync`:
  - landed on `/admin/datasync`
  - sidebar present and visible.
  - screenshot: `/Users/radu/.dev-browser/tmp/nuxt-starter-datasync-sidebar-fixed.png`
