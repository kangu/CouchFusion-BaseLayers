# Summary
- Updated database page layout resolution to support the new admin workspace config namespace.

# Changes
- `utils/register-layout.ts` now resolves layout in this order:
  1. `appConfig.adminWorkspace.layout`
  2. `appConfig.uiNavigation.adminLayout` (legacy fallback)
  3. `default`
- `nuxt.config.ts` now contributes Data Sync navigation to both:
  - `appConfig.adminWorkspace.sections`
  - `appConfig.uiNavigation.sections`

# Why
- Enables migration from `uiNavigation` naming to `adminWorkspace` without regressions in existing apps.
