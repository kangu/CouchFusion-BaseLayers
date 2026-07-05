# Layer: ui_navigation

Runtime: nuxt 4.x, vue 3.5.x

Shared sidebar navigation component + composable for member/admin layouts. Renders role-aware navigation sections, supports desktop and mobile variants, and merges layer-provided sections with app-configured ones (with dedupe).

Consumed by: `apps/bitvocation`, `apps/couchfusioncom` (via `extends` array).

## Folder map

- `app/components/SidebarNavigation.vue` — presentational sidebar component (desktop + mobile variants).
- `app/composables/useSidebarNavigation.ts` — composable that builds role-filtered, deduped sections + mobile menu state.
- `nuxt.config.ts` — registers `#ui-navigation` alias and auto-imports `app/composables`.
- `docs/` — implementation result notes (shared admin nav, dedupe admin links, sidebar navitems TypeError fix).

## Public API / Exports

- Component: `<SidebarNavigation>` (auto-imported via Nuxt component auto-import; `app/components` is auto-scanned).
  - Props: `sections: SidebarNavigationSection[]`, `variant?: "desktop" | "mobile"` (default `"desktop"`).
  - Emits: `navigate` (fired on item click; consumers use it to close mobile menus).
- Composable: `useSidebarNavigation(options?)` — auto-imported.
  - `options.hasRole?: (role: string) => boolean` — role gate (defaults to always-false).
  - `options.navItems?: SidebarNavigationSection[]` — base sections to inject.
  - Returns `{ sections: ComputedRef<SidebarNavigationSection[]>, mobileMenuOpen: Ref<boolean>, toggleMobileMenu, closeMobileMenu }`.
- Types (exported from `useSidebarNavigation.ts`): `SidebarNavigationItem`, `SidebarNavigationSection`, `SidebarNavigationOptions`.
- Layer alias: `#ui-navigation`.
- App config hook: `appConfig.uiNavigation.sections: SidebarNavigationSection[]` — app-supplied sections merged on top of base sections.

## Conventions

- Auto-import only composables from `app/composables` (configured in `nuxt.config.ts` `imports.dirs`). Do not add `app/utils` without updating the config.
- Components live under `app/components` and are prefixed by their directory — currently flat (no prefix), keep `<SidebarNavigation>` as the public name.
- Icons use `mdi:*` iconify names via the `<Icon>` component — the consuming app must provide `nuxt-icon` or an equivalent.
- Role gating is opt-in via `hasRole`; never call auth/store directly inside the composable.
- Mobile menu toggles `document.body` `overflow-hidden` — ensure `closeMobileMenu` is called on route change in consumers.

## Dependencies

- `useAppConfig` from `#imports` (Nuxt core) — used to read `appConfig.uiNavigation.sections`.
- `<Icon>` component + `@iconify` runtime — provided by the consuming app (e.g. via `nuxt-icon`).
- `<NuxtLink>` — Nuxt core.
- Tailwind utility classes (consumer must have Tailwind configured with the `gray`/`orange` palette for default styling to look right).
- No other layer imports; `ui_navigation` is self-contained.

## Build / Test commands

- No standalone lint/typecheck/test setup. No `package.json`, no `vitest.config.ts`.
- Typecheck/test through a consuming app:
  - `apps/bitvocation`: `nuxt typecheck` and `nuxt dev` then visually inspect `/admin` or member sidebar.
- Manual check: render `<SidebarNavigation :sections="sections" variant="mobile" />` and confirm the `Transition` stagger and `overflow-hidden` body class behavior.

## Gotchas / Pitfalls

- Base sections include Bitvocation-specific routes (`/members/jobs`, `/members/cv-doctor`, `/admin/surveys`, ...). For non-Bitvocation consumers, override via `options.navItems` or `appConfig.uiNavigation.sections` to avoid dead links.
- `dedupeSections` keys sections by `id || title` and items by `route` — duplicate routes across base + app config are silently merged, last one wins for ordering.
- The mobile variant applies a per-item transition delay computed from `sectionIndex * section.items.length + itemIndex` — large section lists produce very long stagger delays; consider chunking.
- `toggleMobileMenu` mutates `document.body` directly — SSR-safe only because it runs on user interaction, but don't call it during setup/render.
- `requiresRoles` is `some` (any matching role grants access), not `every`.
- The `2026-02-28..._fix-sidebar-navitems-typeerror.md` doc records a prior bug — re-read it before refactoring section normalization.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`.
- Layer docs: `layers/ui_navigation/docs/` (3 implementation-result notes).
- Related skill: `vuejs-development`.
