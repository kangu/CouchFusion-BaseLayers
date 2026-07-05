# Layer: admin_workspace

Runtime: nuxt 4.x, vue 3.5.x

Reusable Nuxt layer that provides a shared admin shell (sidebar + top bar layout) for back-office sections of apps. Intended to be composed with the `auth` layer (relies on `useAuthStore().hasRole`) and optionally the `content`/`ui_navigation` layers for nav items.

Consuming apps (extend this layer in `nuxt.config.ts`):
- `apps/gas-maintenance`
- `apps/nuxt-app-starter`
- `apps/ping-pong-events`
- `apps/radustanciu`

## Folder map

- `app/components/` — `Icon.vue`, `SidebarNavigation.vue` (sidebar renderer driven by `useSidebarNavigation`).
- `app/composables/` — `useSidebarNavigation.ts` (role-aware nav builder).
- `app/layouts/` — `admin-workspace.vue` (the admin shell layout; wraps `<slot/>` with sidebar + header).
- `docs/` — design notes + `implementation_results/` for task write-ups.
- `nuxt.config.ts` — defines the `#admin-workspace` alias and registers the `app/composables` auto-import dir.

## Public API / Exports

- Layout: `admin-workspace` (auto-registered via Nuxt layouts → use `definePageMeta({ layout: 'admin-workspace' })`).
- Components (imported via alias, NOT auto-global): `#admin-workspace/app/components/SidebarNavigation.vue`, `#admin-workspace/app/components/Icon.vue`.
- Composable (auto-imported): `useSidebarNavigation(options?)` → `{ sections, mobileMenuOpen, toggleMobileMenu, closeMobileMenu }`.
- Types: `SidebarNavigationItem`, `SidebarNavigationSection`, `SidebarNavigationOptions` (exported from `useSidebarNavigation.ts`).
- App config keys (read by the composable): `appConfig.adminWorkspace.sections`, `appConfig.adminWorkspace.iconOverrides`, `appConfig.adminWorkspace.themeClass`, `appConfig.adminWorkspace.brandName`, `appConfig.adminWorkspace.siteName`, `appConfig.adminWorkspace.footerText`. Legacy fallback: `appConfig.uiNavigation.sections`.
- Optional host-app components probed at runtime: global `SiteLogo` and `ToastNotification` Vue components.

## Conventions

- All layer code is namespaced under the `#admin-workspace` alias — do NOT import via relative paths from consuming apps.
- New sidebar entries must come from `appConfig.adminWorkspace.sections` in the consuming app; the layer only ships default admin section when `hasRole('admin')` and no config provided.
- Icon strings use Iconify format (e.g. `mdi:view-dashboard-outline`); `Icon.vue` does static `@iconify/json` imports — do not add dynamic iconify network fetches.
- Roles are checked via `authStore.hasRole(role)` — never assume a specific auth implementation; rely on the auth layer's store contract.
- Dedupe + role filtering happens inside `useSidebarNavigation`; do not pre-filter sections in the consuming app.

## Dependencies

- Runtime: depends on the `auth` layer's `useAuthStore` (with `hasRole(role)` and reactive `user`). Consuming apps must extend `../../layers/auth`.
- Optional: `content` layer auto-injects a "Pages" nav section via its own `appConfig.adminWorkspace.sections` (see `layers/content/nuxt.config.ts`).
- No `package.json` — the layer ships no standalone npm deps; relies on the consuming app's `nuxt`, `vue`, `pinia`, and `@iconify/json` (or similar) for icon rendering.
- No layer-level `extends` (does not extend another layer itself).

## Build / Test commands

No standalone build/test setup. The layer has no `package.json`, no vitest config, no test files.

- Typecheck/lint: run inside a consuming app, e.g. `apps/nuxt-app-starter` — `bun run typecheck` / `bun run lint` (use the app's scripts).
- Tests: none defined for this layer; covered indirectly by consumer app e2e.

## Gotchas / Pitfalls

- `useSidebarNavigation` references `document.body` directly — only call it in client context or guard with `import.meta.client`.
- The layout imports components via the `#admin-workspace` alias; if a consumer renames the alias, the layout breaks.
- Legacy `appConfig.uiNavigation.sections` is still merged — keep new config under `adminWorkspace` to avoid dupes.
- `Icon.vue` expects Iconify JSON to be bundle-resolvable; missing icon data renders nothing (no error).
- No role = no sections; a logged-out user sees an empty sidebar. Always pair with the `auth` middleware on admin routes.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/2026-02-28T14-31-26Z_admin-workspace-layer-bootstrap.md`, `docs/2026-03-17T11-47-50Z_admin-theme-hook-contract.md`
- Related skills: `couchfusion-layer-builder`, `vuejs-development`
- Sibling layers it composes with: `layers/auth`, `layers/content`, `layers/ui_navigation`
