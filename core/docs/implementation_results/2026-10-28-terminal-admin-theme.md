# Terminal admin theme, light/dark pair (2026-10-28)

The Terminal direction from the design lab (C dark, D light) is now the core layer's admin and login design.

## What changed

- `src/features/ui-theme/terminal.css`: both token sets, shared components (buttons, inputs, pills, panels, KPI strip, tables, key-value lists, empty state) and the ruled T-frame shell. Everything is scoped to `.cf-ui` and prefixed `cf-`. `<html data-cf-scheme>` selects light, dark or system (system follows `prefers-color-scheme`). The selection mark is a 1px accent line (`#d27800` light, `#f7931a` dark); figures use IBM Plex Mono, text Public Sans (Google Fonts, with system fallbacks).
- `useCouchDBColorScheme()` / `useCouchDBThemeHead()`: the person's choice in the `couchdb_color_scheme` cookie (1 year, lax), else `admin_theme`. The attribute is set through `useHead`, so SSR paints the right scheme. Both are auto-imported when auth is enabled.
- `SchemeToggle.vue` (Match system / Light / Dark, `aria-pressed`) and `CouchMark.vue` (the couch logo).
- `admin-workspace.vue`: 64px top bar (brand, breadcrumb with the page title, `#aw-header-actions`, scheme toggle), labelled sidebar with role-filtered sections, user row with sign-out, full-screen menu sheet under 960px. Kept: `admin-shell`, `admin-header-title`, `admin-user-name`, `admin-logout`, the skip link, `useCouchDBAdminTitle`.
- `admin/index.vue`: overview built from real data: people, admins, other roles and no-role counts plus a people list from `/api/couchdb/admin/users`, and the current session. Loading skeletons and an in-block error with Retry. People rows fold to two lines on phones.
- `login.vue`: same logic; new layout (brand and toggle on top, centred card, footer from `admin_footer_text` or the site name), styled password, email, Nostr and no-access states.
- `admin_theme` is now `system | light | dark` (default `system`); the retired `ledger` and `classic` are read as `system`, including in previously generated options.

## Checks

- `pnpm test` 108 passed (new: colour-scheme default, legacy mapping, stale generated options, invalid value; template compile for the two new components).
- `pnpm typecheck` clean (`src/features/ui-theme` excluded from the Node typecheck like other app code).
- `pnpm test:nuxt` 5 passed (new: SSR renders `data-cf-scheme` as system by default, dark from the cookie, system for an invalid cookie).
- `pnpm test:matrix`: all four feature builds pass.
- Browser (cf-cloud dev): login → overview with real `_users` data, switch to light, reload keeps light, phone menu and sign-out, non-admin no-access panel. taste-skill inspector on the production login page: 0 FAIL (the dev-only failure was the Nuxt DevTools overlay).
- Found and fixed: the browser's default body margin made themed pages scroll by 16px.

## Not done

- Data Sync page (Tailwind-based, 1,367 lines) is not restyled; it renders inside the new shell with its old classes.
- The design-lab modules (databases, users, content, orders, analytics, settings) are prototypes only; each needs its own API before it can become a page.
- The top bar has no search or server switcher yet (both need backing data).
