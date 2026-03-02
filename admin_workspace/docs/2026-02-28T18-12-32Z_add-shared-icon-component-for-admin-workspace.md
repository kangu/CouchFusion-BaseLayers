# Summary
Added a shared `Icon` component to `admin_workspace` so `SidebarNavigation` and `admin-workspace` can render icons without relying on app-local `Icon.vue`.

# Problem
- Error: `Failed to resolve component: Icon`
- Cause: `admin_workspace` used `<Icon>` but the implementing app did not provide an `Icon` component.

# Changes
- Added `app/components/Icon.vue` in `admin_workspace`.
- API mirrors Bitvocation usage (`name`, `size`, `label`, `role` props).
- Runtime behavior:
  - attempts to load `@iconify/vue` dynamically when available
  - falls back to a simple neutral glyph if Iconify is not installed

# Outcome
- `Icon` now resolves from the layer itself, removing dependency on host-app component registration.
