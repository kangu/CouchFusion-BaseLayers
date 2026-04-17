# Initial Prompt
Implement support for "global" content components that:
- appear in Select Component gallery,
- serialize as alias-like minimark nodes (example: `GlobalFooter`),
- render from a global registry in SSR/client,
- allow local page-level prop overrides with warnings,
- and are manageable from admin UI.

# Plan
1. Add a content DB-backed global component registry and API endpoints.
2. Extend runtime `Content` renderer to resolve global aliases and merge default props with local overrides.
3. Merge global aliases into builder component gallery at runtime, based on existing generated `component-definitions.ts`.
4. Ensure serialization supports bare alias node shape when no local props are set.
5. Add admin management UI in `/admin/pages` for alias/target/enabled/default-props configuration.
6. Validate with Nuxt type generation.

# Implementation Summary
- Added shared global registry helpers:
  - `layers/content/utils/global-components.ts`
- Added server persistence utility:
  - `layers/content/server/utils/global-components-settings.ts`
- Added content API endpoints:
  - `GET /api/content/global-components`
  - `GET /api/content/global-components/admin` (admin auth)
  - `PUT /api/content/global-components/admin` (admin auth)
- Added client composable for fetch/save state:
  - `layers/content/app/composables/useGlobalComponentsRegistry.ts`
- Extended runtime renderer:
  - `layers/content/app/components/runtime/content/Content.vue`
  - `layers/content/app/components/runtime/content/types.ts`
  - Added `globalComponents` prop support.
  - Global alias resolution now maps alias -> target component and merges `defaultProps` + local props.
  - Added dev warning when local props override global defaults (override remains allowed by design).
- Builder integration:
  - `layers/content/app/components/builder/Workbench.vue`
  - Fetches public global registry and merges global aliases into `componentOptions` at runtime.
  - Reuses base schema from existing generated definitions (`component-definitions.ts`) for node editor fields.
  - Passes `global-components` into preview `<Content>`.
- Serialization behavior:
  - `layers/content/app/utils/contentBuilder.ts`
  - Preserves PascalCase alias IDs.
  - For PascalCase aliases with no props/children, serializes to bare node entry (`["GlobalFooter"]`) instead of forcing `{}`.
- Admin UI integration in `/admin/pages`:
  - `layers/content/app/pages/admin/pages.vue`
  - Added Global Components panel for alias management:
    - alias id,
    - target component,
    - enabled toggle,
    - default props JSON,
    - add/remove/save actions.
  - Includes explicit note that local overrides are allowed and take precedence.

# Validation
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
- Runtime HTTP endpoint verification was not executed because local dev server was not running at validation time.

# Next Steps
1. Start `nuxt-app-starter` dev server and verify `/admin/pages` Global Components panel end-to-end save/load.
2. Insert a global alias in builder and confirm serialized minimal node shape (`["GlobalAlias"]`) when no local props are set.
3. Confirm SSR page render and hydration both resolve global aliases with shared defaults.
4. Confirm dev console warning appears only when local page props override global defaults.
