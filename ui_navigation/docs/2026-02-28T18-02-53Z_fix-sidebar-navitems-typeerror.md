# Summary
Fixed a runtime crash in `useSidebarNavigation` affecting admin/member layouts.

# Issue
- Error: `sections.push is not a function`
- Cause: `navItems` defaulted to a function (`() => []`) instead of an array, then `buildBaseSections` attempted array operations on it.

# Changes
- `app/composables/useSidebarNavigation.ts`
  - `const navItems = options.navItems ?? [];`
  - Base section initialization now uses defaults when no custom nav items are provided:
    - `const sections = navItems.length ? [...navItems] : [ ...defaultSections ]`

# Outcome
- Restores stable SSR/runtime behavior for `members`/admin layouts using this composable.
- Keeps default sections available when `navItems` is not supplied.
