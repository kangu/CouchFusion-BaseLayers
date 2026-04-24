# Initial Prompt
I want the switch to come from somewhere in `nuxt.config` and only apply to parts that generate output or head links.

# Plan Followed
1. Add one shared runtime-styling flag resolver sourced from `runtimeConfig.content`.
2. Wire flags into runtime/head-link producers (Nuxt plugins + runtime CSS/asset endpoints).
3. Keep admin save/settings APIs untouched so builder editing workflows are not blocked.

# Implementation Summary
- Added shared config resolver:
  - [content/utils/runtime-styling.ts](/Users/radu/Projects/nuxt-apps/layers/content/utils/runtime-styling.ts:1)
  - Supports:
    - `runtimeConfig.content.runtimeStyling.enabled`
    - `runtimeConfig.content.runtimeStyling.fonts.enabled` (or `fonts: false`)
    - `runtimeConfig.content.runtimeStyling.theme.enabled` (or `theme: false`)

- Added runtime assertion helpers for output endpoints:
  - [content/server/utils/content-runtime-styling.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-runtime-styling.ts:1)

- Kept switch in `nuxt.config` defaults:
  - [content/nuxt.config.ts](/Users/radu/Projects/nuxt-apps/layers/content/nuxt.config.ts:48)

- Applied flags only to runtime/head-output paths:
  - Head link plugins:
    - [content/app/plugins/content-runtime-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/plugins/content-runtime-fonts.ts:1)
    - [content/app/plugins/content-runtime-theme.ts](/Users/radu/Projects/nuxt-apps/layers/content/app/plugins/content-runtime-theme.ts:1)
  - Public runtime output APIs:
    - [content/server/api/content/fonts/runtime.css.get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/fonts/runtime.css.get.ts:1)
    - [content/server/api/content/fonts/preload.get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/fonts/preload.get.ts:1)
    - [content/server/api/content/fonts/active/[key].get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/fonts/active/[key].get.ts:1)
    - [content/server/api/content/fonts/asset/[name].get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/fonts/asset/[name].get.ts:1)
    - [content/server/api/content/theme/runtime.css.get.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/theme/runtime.css.get.ts:1)

- Builder runtime/head side effects now respect the same flags:
  - [content/app/components/builder/Workbench.vue](/Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/Workbench.vue:1)
  - Typography/Theme panels and preview link emissions are hidden/skipped when disabled.

# Verification
- Ran:
  - `bunx vitest --config content/vitest.fonts.config.ts --run`
- Result:
  - `2` files passed
  - `15` tests passed
