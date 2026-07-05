# Content Layer Project State And Feature Readiness

## Initial Prompt

Analyse the current project state thoroughly considering all aspects involved, review the past work from `/docs` folders, and prepare to implement work on features.

## Scope

- Selected target: `layers/content`.
- Layer instructions source: `layers/content/agents.md`.
- No feature implementation was requested yet, so this pass focused on state analysis, docs review, coupling, verification, and readiness.
- Existing uncommitted source change observed and left untouched: `layers/content/utils/page.ts`.

## Current Layer Shape

`layers/content` is a custom CouchDB-backed Nuxt 4 content-builder layer, not `@nuxt/content`.

Main surfaces:

- Runtime page rendering and content route middleware.
- `/admin/pages` page inventory, filtering, creation, cloning, deletion, and publication-state editing.
- Builder and node editor UI under `pages/builder/[[...target]].vue` and `app/components/builder`.
- Admin fields under `app/components/admin`, including image, rich-text, and animation editing.
- Inline live editor and iframe focus bridge.
- Content page Pinia store exported as `useContentPagesStore`.
- CouchDB-backed APIs for pages, history, publication state, fonts/theme, i18n settings, LLM translations, local images, component picker categories, and global components.
- Shared locale labels and trusted inline SVG flags via `app/utils/locales-meta.ts` and `app/assets/flags/*.svg`.

High-risk orchestration files remain:

- `app/components/admin/ContentAdminWorkbench.vue`
- `app/components/builder/Workbench.vue`
- `app/components/builder/NodeEditor.vue`
- `app/components/builder/ComponentPickerDialog.vue`
- `app/composables/useContentLiveUpdates.ts`
- `app/stores/pages.ts`
- `server/api/content/pages.get.ts`
- `server/utils/content-pages-save.ts`

## Documentation Review

The content docs corpus is broad and current:

- `401` markdown files under `layers/content/docs`.
- `240` implementation-result files under `layers/content/docs/implementation_results`.
- `25` spec files under `layers/content/docs/specs`.

Recent implementation history shows active work around:

- Draft/published page state with server-side gating and sitemap exclusion.
- Content-agent context trimming and updated layer instructions.
- Component picker runtime categories and preview sizing.
- Global component aliases, default props, usage guards, and builder/runtime sync.
- Admin pages table filtering, pagination, language coverage, creation, and cloning.
- Runtime font/theme settings backed by CouchDB documents and `_config` conventions.
- Inline preview focus/click reliability and `data-prop-id` targeting.
- Locale metadata centralization and inline SVG flag expansion.
- LLM translation workflows, staged locale editing, SEO translation, and fixed-path propagation.

## Latest Feature State

The latest substantial feature, draft page state, is present in source:

- `ContentPagePublicationState` exists in `types/content-page.ts`.
- `normalizePublicationState()` exists in `utils/page-documents.ts`.
- Draft reads are gated in `server/api/content/pages.get.ts`.
- `PATCH /api/content/pages/publication-state` exists.
- `useContentPagesStore.updatePublicationState()` exists.
- `/admin/pages` includes status filtering and row-level status select controls.
- `layers/sitemap-xml/server/api/sitemap.xml.get.ts` excludes draft content routes and localized members of draft page groups.
- Focused tests exist in `content/tests/api-content-pages.spec.ts` and `sitemap-xml/tests/sitemap-draft-pages.spec.ts`.

## Consumer Coupling

Apps currently referencing or extending the content layer include:

- `bitvocation`
- `couchfusioncom`
- `forest-cabin`
- `indux` through a symlinked external app
- `kangu`
- `kids-store`
- `nuxt-app-starter`
- `pacanele-landing`
- `ping-pong-events`
- `radustanciu`
- `smart-lead`
- `testing-1`
- `tulin-delivery`

Several consumers also use official `@nuxt/content`, so new work must not assume this custom layer owns every content concern in every app.

Before app-specific changes, inspect the selected app's `agents.md` and `nuxt.config.ts`; keep edits out of other apps unless explicitly requested.

## Verification

Passed:

- `bunx vitest --config layers/content/vitest.fonts.config.ts --run`
  - `2` files passed.
  - `19` tests passed.
- From `layers`: `bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`
  - `1` file passed.
  - `15` tests passed.
- From `layers`: `bunx vitest --config vitest.config.ts sitemap-xml/tests/sitemap-draft-pages.spec.ts --run`
  - `1` file passed.
  - `2` tests passed.
- From `layers/content`: `bunx vitest --config ../vitest.config.ts tests/admin/content-admin-workbench-translation-menu.spec.ts tests/builder/focused-editor-mode.spec.ts --run`
  - `2` files passed.
  - `5` tests passed.

Not fully green as a single broad command:

- From `layers`: `bunx vitest --config vitest.config.ts content/tests --run`
  - `21` files passed, `2` failed.
  - `100` tests passed, `5` failed.
  - Failures were path-harness failures in source-inspection specs that read `process.cwd()/app/...`, resolving to `layers/app/...` instead of `layers/content/app/...`.
- From `layers/content`: `bunx vitest --config ../vitest.config.ts tests --run`
  - `20` files passed, `3` failed.
  - `91` tests passed, `6` failed, plus one failed suite.
  - This flips the cwd problem: some auth/session and fixture tests expect the `layers` root or layer-config paths.
- From repo root: `bunx vitest --config layers/vitest.config.ts ...`
  - Uses a different `bunx` Vitest resolution and fails to find `_tests/setup/content.ts`.
  - Recursive discovery can also pick up the symlinked `apps/indux/layers/content/tests` copy.

## Readiness Assessment

The layer is feature-ready, but the implementation posture should be conservative:

- Keep feature slices narrow and additive.
- Avoid broad rewrites in `ContentAdminWorkbench.vue`, `Workbench.vue`, `NodeEditor.vue`, and `useContentLiveUpdates.ts`.
- Preserve existing contracts:
  - page reads/writes through `useContentPagesStore` and `/api/content/pages*`,
  - content registry generation via `bunx content-registry`,
  - inline preview focus through `useContentPropId` / `data-prop-id`,
  - locale metadata through `#content/app/utils/locales-meta`,
  - CouchDB `_config` sections named `cf_env_[slug]`.
- Add `builderFieldMeta` select metadata for content component props with two or more discrete options.

## Recommended Next Work

1. Standardize the content-layer Vitest command or harden cwd-dependent specs before relying on one broad suite command.
2. For a new feature, choose one surface first:
   - admin pages table/workflow,
   - builder/node editor ergonomics,
   - runtime rendering,
   - localization/translation,
   - global components,
   - runtime font/theme settings.
3. Use focused tests first, then run the relevant CouchDB-backed suite from the command context that matches the touched files.
4. For browser-visible admin or builder work, verify in a consuming app after reading that app's `agents.md`.

