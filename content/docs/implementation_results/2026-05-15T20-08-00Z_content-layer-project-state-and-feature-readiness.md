# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved, review the past work from `/docs` folders and prepare to implement work on features.

# Scope
- Selected target: `layers/content`.
- No layer-local `AGENTS.md` exists, so the root workspace instructions apply.
- No tracked local diffs are currently present under `layers/content`.
- The broader worktree is dirty with unrelated root/output/skill changes; those were left untouched.

# Current Layer Shape
The content layer is the shared implementation point for:
- runtime content page rendering and routing,
- `/admin/pages` management,
- builder and node editor workflows,
- inline preview synchronization,
- content component registry loading,
- image, rich-text, JSON array/object field editing,
- locale metadata and inline SVG flags,
- LLM-assisted translation workflows,
- runtime fonts and theme configuration backed by CouchDB settings/config.

High-impact entry points remain:
- `layers/content/nuxt.config.ts`
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/app/components/builder/ComponentPickerDialog.vue`
- `layers/content/app/components/builder/NodeEditor.vue`
- `layers/content/app/composables/useContentLiveUpdates.ts`
- `layers/content/app/stores/pages.ts`
- `layers/content/server/utils/content-fonts.ts`
- `layers/content/server/utils/content-theme.ts`
- `layers/content/server/utils/content-pages-save.ts`
- `layers/content/server/utils/llm-translations-run.ts`

# Documentation Review
The docs and implementation history show the layer is mature and actively used. Recent streams concentrate on:
- component picker previews and responsive thumbnail scaling,
- inline preview click/focus reliability through `data-prop-id`,
- global component registry and alias editing,
- runtime font settings and CouchDB attachment persistence,
- runtime Tailwind/theme token settings,
- locale metadata/flag centralization,
- page-scope and field-scope LLM translation,
- admin pages table, filtering, language coverage, creation, and cloning,
- nested JSON array/object editing and insert/reorder dialogs.

The latest readiness notes from March and April correctly describe the current risk profile: implementation risk is concentrated in orchestration files, while the supporting primitives and tests are now fairly broad.

# Consumer Coupling
Apps currently extending `layers/content` include:
- `apps/bitvocation`
- `apps/couchfusioncom`
- `apps/ping-pong-events`
- `apps/smart-lead`
- `apps/nuxt-app-starter`
- `apps/pacanele-landing`
- `apps/tulin-delivery`
- `apps/kangu`
- `apps/testing-1`
- `apps/forest-cabin`
- `apps/radustanciu`

The most visible current consumers are Bitvocation, CouchFusion, Ping Pong Events, and Smart Lead. For app-specific feature work, keep app edits scoped to the selected app and use the content layer only for shared behavior.

# Standards Alignment
- Shared locale metadata is centralized in `layers/content/app/utils/locales-meta.ts`.
- Shared inline SVG flags live under `layers/content/app/assets/flags/*.svg`.
- Runtime env-style configuration follows the `cf_env_[slug]` convention in current font/theme-related work.
- `runtimeConfig.public.appSlug` is the important stable slug source for CouchDB `_config` lookups.
- Content-builder components with discrete prop choices should continue to expose `builderFieldMeta` select metadata.

# Verification
Focused sandbox-friendly suite:
- Command: `bunx vitest --config layers/content/vitest.fonts.config.ts --run`
- Result: passed, `2` files and `17` tests.

Full content-layer suite:
- Command: `./node_modules/.bin/vitest --config vitest.config.ts content/tests/**/*.spec.ts --run`
- Working directory: `layers`
- Result with default sandbox: failed because local CouchDB connections to `::1:5984` and `127.0.0.1:5984` were blocked with `EPERM`.
- Result with approved local CouchDB access: passed, `13` files and `65` tests.

# Feature Readiness
The layer is ready for new feature work, but the safest implementation posture is narrow and additive:
- isolate builder UI changes into focused subcomponents/composables when possible,
- preserve the existing inline preview contract (`useContentPropId` / `data-prop-id` -> iframe message -> node editor focus),
- keep locale editing changes compatible with staged locale documents and fixed-path propagation,
- avoid broad rewrites inside `ContentAdminWorkbench.vue`, `Workbench.vue`, `NodeEditor.vue`, and `useContentLiveUpdates.ts`,
- use the broad content suite with CouchDB access before claiming completion for DB, routing, i18n, builder, or runtime-rendering changes.

# Recommended Next Feature Slices
1. Builder/admin ergonomics: focused improvements to pages table, component picker, node editor fields, or preview controls.
2. Runtime styling: extend the existing font/theme settings model instead of introducing a parallel config store.
3. Localization: build on shared `locales-meta.ts`, current i18n settings APIs, and the existing staged translation/report flow.
4. Content component authoring: keep changes app-local unless the behavior is reusable across multiple apps.

# Immediate Next Step
Choose the specific feature area and target consumer surface before implementation:
- content-layer-only shared behavior,
- one app consuming the content layer,
- or a cross-cutting change that must be designed for several consumers.
