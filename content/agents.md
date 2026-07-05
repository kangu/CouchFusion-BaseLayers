# Layer: content

Runtime: Nuxt 4.x, Vue 3.5.x.

Custom CouchDB-backed content-builder layer. It renders page documents, provides the admin page list and node editor, runtime content rendering, i18n helpers, local images, runtime fonts/theme, LLM translation support, and the content component registry. This is not `@nuxt/content`; do not assume official Nuxt Content APIs exist.

Before changing behavior, inspect the consuming app's `nuxt.config.ts` and app-level `agents.md`. Multiple apps extend this layer, and app instructions can override validation commands or UI expectations.

## Critical Paths

- `app/pages/admin/pages.vue` — content page inventory/admin list.
- `pages/builder/[[...target]].vue` and `app/components/builder/` — node editor route and editor UI.
- `app/components/runtime/content/` — runtime content renderer and registered content blocks.
- `app/components/admin/` — admin workbench fields such as images and rich text.
- `app/stores/pages.ts` — Pinia store exported as `useContentPagesStore`.
- `server/api/content/` — page, history, publication-state, fonts/theme, i18n, translation, local-image, and component-picker endpoints.
- `server/utils/` — Nitro helpers for page save/read, i18n, fonts/theme, history, auth, and settings.
- `utils/page-documents.ts`, `utils/design-documents.ts`, `utils/i18n.ts`, `utils/i18n-body.ts`, `utils/page.ts` — shared document/path/i18n primitives.
- `scripts/generate-component-registry.mjs` — component registry generation.
- `docs/` — search by topic/date before changing older behavior.

## Public Surfaces

- Alias: `#content`.
- Main routes: `/admin/pages`, `/builder/[[...target]]`, and runtime page rendering through `<Content>`.
- Page API group: `/api/content/pages*`, including `PATCH /api/content/pages/publication-state`.
- Runtime config: `content.runtimeStyling.{enabled, fonts.enabled, theme.enabled}` and `content.i18n.{defaultLocale, locales[]}`.
- The layer requires consumer `runtimeConfig.dbLoginPrefix`; missing config fails during Nuxt startup.

## Conventions

- Content components belong under `app/components/runtime/content/` and are loaded through the runtime registry, not Nuxt global auto-import.
- Builder/admin components under `app/components/{builder,admin}/` are also stripped from Nuxt global component auto-import; import/register them explicitly.
- Any content component prop with two or more discrete options must declare `builderFieldMeta` with `type: 'select'` and `options` in a non-setup `<script lang="ts">` block.
- Locale labels and flags live in `app/utils/locales-meta.ts`, importing trusted local SVGs from `app/assets/flags/<locale>.svg?raw`; keep keys aligned with `runtimeConfig.content.i18n.locales`.
- Page docs are CouchDB documents; do not bypass the page store or `/api/content/pages*` server utilities for normal reads/writes.
- The CouchDB design document lives in `utils/design-documents.ts` and is pushed on init; do not duplicate views elsewhere.
- Prefer `#content` and `#database` aliases over fragile relative imports across layer boundaries.

## Commands

- Full layer tests from repo root: `bunx vitest --config layers/vitest.config.ts content/tests --run`.
- Focused content test: `bunx vitest --config layers/vitest.config.ts <path> --run`.
- Font/theme server tests: `bunx vitest --config layers/content/vitest.fonts.config.ts --run`.
- Bitvocation content tests: `bunx vitest --config layers/bitvocation-content.vitest.config.ts --run`.
- Regenerate component registry after adding or changing content components: `bunx content-registry`.
- Run consumer app lint/typecheck only when requested or allowed by that app's instructions.

## Gotchas

- `hooks.ready` throws if the consuming app lacks `runtimeConfig.dbLoginPrefix`.
- Runtime and builder components will not resolve as casual `<MyComponent />` tags unless explicitly registered.
- The catch-all `/builder/[[...target]]` can shadow app routes if a consumer also defines `/builder/*`; inspect `extends` order.
- Inline SVG flags must stay trusted/local; never render remote SVG strings with `v-html`.
- `component-registry-watch` is dev-only; run the registry generator before build when component definitions changed.
- `server/api/content/pages.post.ts` has i18n migration behavior on first save; run i18n page-save tests before modifying it.
- Runtime styling is opt-out with `runtimeConfig.content.runtimeStyling.*`; font/theme changes may affect all consuming apps.

## Cross-References

- Root project instructions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`.
- Related layers to inspect when relevant: `layers/database`, `layers/auth`, `layers/admin_workspace`, `layers/sitemap-xml`.
