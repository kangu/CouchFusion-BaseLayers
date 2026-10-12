# Ledger Admin Theme

## Summary
The admin-workspace layout ships a default visual theme. Its look is "Sheet" (since 2026-10-12): the content is a white rounded panel inset from a cool grey frame that the sidebar shares, one sans family (Geist) for everything with monospaced micro-labels (Geist Mono), hairline borders, ink buttons and a single blue accent. The theme key and CSS class keep their original name, `ledger`, from the first serif-based version.

Typography is token-driven (`--aw-font-display`, `--aw-font-label`, `--aw-display-weight`, `--aw-display-tracking`, `--aw-title-size`, `--aw-heading-size`, `--aw-figure-size`), so a different look is a token change.

## How it is applied
- `app/assets/css/ledger.css` holds the theme. It is imported by `app/layouts/admin-workspace.vue`, so it only loads on routes that use the layout.
- The layout adds the class `aw-theme-ledger` to `.aw-shell`. Every rule in the stylesheet is scoped under `.aw-shell.aw-theme-ledger`.
- Fonts are loaded from Google Fonts through `useHead` in the layout, only while the theme is active.

## Config contract
`appConfig.adminWorkspace.theme`: `"ledger" | "classic"`.
- Unset and no `themeClass`: Ledger.
- Unset with a `themeClass` (for example gas-maintenance): classic, so existing custom themes are not disturbed.
- Set explicitly: the given value wins.

## Isolation
Apps that do not extend `admin_workspace` (for example bitvocation, which renders layer admin pages inside its own `members` layout) never get the `.aw-shell.aw-theme-ledger` ancestor, so the analytics, content and other layer pages look exactly as before there. Keep it that way: restyle layer admin pages from `ledger.css` under the scoped prefix, not by editing the page's own styles.

## Tokens
`--aw-canvas`, `--aw-surface`, `--aw-sunken`, `--aw-hover`, `--aw-ink`, `--aw-ink-2`, `--aw-muted`, `--aw-line`, `--aw-line-strong`, `--aw-accent`, `--aw-accent-text`, `--aw-accent-soft`, `--aw-good(-soft)`, `--aw-warn(-soft)`, `--aw-bad(-soft)`, `--aw-font-ui`, `--aw-font-display`, `--aw-font-mono`, `--aw-radius`, `--aw-radius-sm`.

An app can tint the theme by overriding tokens on `.aw-shell.aw-theme-ledger` in its own CSS.

## Structure (Ledger only)
- Sidebar: one flat list. A section with 4 or more items is folded into a single link named after the section (`activeRoutes` keeps it highlighted on every page of the section).
- Section tabs: when the current route belongs to a folded section, its items render as a tab bar (`.aw-section-tabs`) under the header.
- Header: carries the page title (`.aw-header-title`, an `h1`): the folded section title or the navigation label. Pages hide their own titles under the theme. A page can set its own title with `useAdminWorkspaceHeaderTitle(title)` and teleport page actions into `#aw-header-actions` (inside `<ClientOnly>`; hidden below 640px). Brand mark (`.aw-brand-mark`) comes from the first letter of `brandName` when no `SiteLogo` is registered.

## Covered
- Shell: sidebar, navigation, collapse toggle, header, profile menu, content background.
- Analytics (`.cfa`): token mapping, serif titles and KPI figures, joined KPI strip, ink primary buttons, chart colours. `TimeChart.vue` reads two new optional tokens, `--cfa-chart-curve` (default `smooth`) and `--cfa-chart-marker-size` (default `0`); Ledger sets `straight` and `3`.
- Content pages list (`/admin/pages`): title, slim language bar, filters, buttons, table, pills, quiet secondary row actions. CSS only, no template change in the content layer.

## Login page
`app/plugins/ledger-auth-theme.ts` themes the auth layer's `/login` page (path from `runtimeConfig.public.authLoginPath`) when Ledger is active. It adds `aw-theme-ledger-auth` to `<html>` on that route only, plus `--aw-brand-name` / `--aw-brand-initial` CSS variables from `adminWorkspace.brandName`; `app/assets/css/ledger-auth.css` is scoped to that class. The auth layer's page is not edited, so apps without this layer keep the original login. The theme decision lives in `useAdminWorkspaceTheme()`.

## Not covered yet
- Prototype details that need template changes in other layers: KPI sub-captions, title and path stacked in one Pages column, a row overflow menu, filter chips, command palette.
- Modals and other admin pages (products, email templates, maintenance, events).
- Dark mode: Ledger is light only and overrides `.dark .cfa` tokens inside the shell.
