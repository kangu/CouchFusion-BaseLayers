# Initial Prompt
Why don't I see the Conferences menu item in the members layout sidebar when logged in as "curator" role? I see it when logged in as "admin"

# Plan
1. Inspect events layer sidebar registration to verify role filters for the Events section and Conferences item.
2. Update role requirements from admin-only to include curator.
3. Keep route/API permissions aligned with earlier role update for conference list loading.

# Implementation Summary
The sidebar item was hidden because events navigation config was explicitly admin-only.

## Root Cause
- `layers/events/nuxt.config.ts` registered both `adminWorkspace.sections` and `uiNavigation.sections` with:
  - section `requiresRoles: ["admin"]`
  - item `requiresRoles: ["admin"]`
- Sidebar composables correctly enforce these role gates, so `curator` users were filtered out.

## Fix Applied
- Updated both section-level and item-level role requirements to:
  - `requiresRoles: ["admin", "curator"]`
- Applied in both config trees:
  - `appConfig.adminWorkspace.sections`
  - `appConfig.uiNavigation.sections`

# Next Steps
1. Reload the app and verify `curator` now sees `Events -> Conferences` in members sidebar.
2. If the menu still does not appear, restart the Nuxt dev server because `nuxt.config.ts` changes can require a restart.
