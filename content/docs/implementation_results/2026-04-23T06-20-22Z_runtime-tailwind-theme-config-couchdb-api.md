# Initial Prompt
I want to update the site configuration system so all the `:root` parameters from `main.css` which are tailwind configuration basically to be loaded from a couchdb proxied api request, similar to how the fonts are loaded. I want to build a two layered configuration for tailwind inside the content layer: a "simple" view where users can change colors and the most common dimensions and such, then a "full" tailwind config where everything is listed. Extend the `:root` variables structure to the full extent that tailwind can handle so configuration can be done as much as possible at runtime.

# Plan Followed
1. Add a reusable content-layer runtime theme domain with CouchDB persistence (`content-settings:theme`) and allowlisted token schema (simple/full metadata, read-only compile-time and font-owned tokens).
2. Expose content-layer APIs for theme settings save/apply and a public runtime CSS endpoint.
3. Inject runtime theme CSS via a dedicated content plugin, with versioned URL tied to reactive state.
4. Extend builder with a Theme panel (Simple/Full), draft save/apply workflow, and live preview emission.
5. Extend inline preview messaging and client receiver to apply draft theme token overrides in iframe.
6. Add focused server tests for preset resolution, token validation, and runtime CSS rendering.

# Implementation Summary
- Added new server theme module:
  - [layers/content/server/utils/content-theme.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-theme.ts:1)
  - Implements:
    - `content-settings:theme` document model
    - app-slug preset resolution (`bitvocation` preset included)
    - allowlisted token schema with namespace metadata
    - draft validation (`normalizeContentThemeDraftTokens`)
    - save/apply lifecycle
    - runtime CSS rendering (`renderRuntimeThemeCss`)

- Added new theme APIs:
  - [layers/content/server/api/content/theme/settings.get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/theme/settings.get.ts:1)
  - [layers/content/server/api/content/theme/settings.put.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/theme/settings.put.ts:1)
  - [layers/content/server/api/content/theme/apply.post.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/theme/apply.post.ts:1)
  - [layers/content/server/api/content/theme/runtime.css.get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/theme/runtime.css.get.ts:1)

- Added runtime theme head plugin and registered it:
  - [layers/content/app/plugins/content-runtime-theme.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/plugins/content-runtime-theme.ts:1)
  - [layers/content/nuxt.config.ts](/Users/radu/Projects/nuxt-apps/layers/content/nuxt.config.ts:1)

- Added admin composable for theme settings:
  - [layers/content/app/composables/useContentThemeSettings.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/composables/useContentThemeSettings.ts:1)

- Extended builder/admin/inline preview flow:
  - [layers/content/app/components/builder/Workbench.vue](/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/Workbench.vue:1)
    - New Theme panel:
      - Simple/Full modes
      - draft edit/reset/save
      - apply button (two-step workflow)
      - `theme-preview-change` emission for live iframe preview
  - [layers/content/app/components/admin/ContentAdminWorkbench.vue](/Users/radu/Projects/nuxt-apps/layers/content/app/components/admin/ContentAdminWorkbench.vue:1)
    - Forwards `theme-preview-change`
  - [layers/content/app/components/inline/InlineLiveEditor.vue](/Users/radu/Projects/nuxt-apps/layers/content/app/components/inline/InlineLiveEditor.vue:1)
    - Sends `builder_theme_preview` postMessage to iframe
  - [layers/content/app/composables/useContentLiveUpdates.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/composables/useContentLiveUpdates.ts:1)
    - Receives `builder_theme_preview`
    - Applies `:root` token overrides in iframe via dedicated style tag

- Added focused tests and updated focused config:
  - [layers/content/tests/server/theme-settings.spec.ts](/Users/radu/Projects/nuxt-apps/layers/content/tests/server/theme-settings.spec.ts:1)
  - [layers/content/vitest.fonts.config.ts](/Users/radu/Projects/nuxt-apps/layers/content/vitest.fonts.config.ts:1)

# Verification
- Ran:
  - `bunx vitest --config content/vitest.fonts.config.ts --run` (from `layers/`)
- Result:
  - `2` files passed
  - `15` tests passed

# Proposed Next Steps
1. Add an optional public metadata endpoint for runtime theme version bootstrap (to avoid initial timestamp-based cache-busting).
2. Add E2E coverage for Theme panel draft/save/apply + iframe live preview behavior.
3. Gradually expand the allowlisted key set per project needs, keeping compile-time-only namespaces explicitly read-only.
