## Initial Prompt
I get this error while running "bun run build":  WARN  [plugin vite:reporter]                                                                                                                                            3:46:47 PM
(!) /Users/radu/Projects/nuxt-apps/layers/content/app/components/runtime/content/Content.vue is dynamically imported by /Users/radu/Projects/nuxt-apps/layers/content/app/components/runtime/content/Content.vue?nuxt_component=async&nuxt_component_name=Content&nuxt_component_export=default but also statically imported by /Users/radu/Projects/nuxt-apps/apps/couchfusioncom/app/pages/[...slug].vue?vue&type=script&setup=true&lang.ts, /Users/radu/Projects/nuxt-apps/layers/content/app/components/builder/Workbench.vue?vue&type=script&setup=true&lang.ts, dynamic import will not move module into another chunk.. Investigate and propose fixes

## Implementation Summary
Removed the auto-scanned component directories from the content layer and introduced a dedicated plugin that registers `Content.vue` and `ContentMarginWrapper.vue` synchronously, ensuring those runtime components are always statically imported and shared across the app so Vite no longer reports mixed static/dynamic imports during `bun run build`.

## Documentation Overview
- Added `app/plugins/register-runtime-content-components.ts` to register the `Content` renderer (and margin wrapper) synchronously, replacing Nuxt’s auto-scanned registration that produced async bundles.
- Updated `layers/content/nuxt.config.ts` to include the new plugin, clamp auto-scanned layer directories to `.vue` files via the `components:dirs` hook, and filter the resulting component list with `components:extend` so builder/runtime components stay out of Nuxt’s lazy component pipeline entirely.
- These adjustments keep consuming apps compatible while eliminating the mixed static/dynamic chunk warning during production builds.

## Implementation Examples
```ts
// layers/content/app/plugins/register-runtime-content-components.ts
import Content from '../components/runtime/content/Content.vue'
import ContentMarginWrapper from '../components/runtime/ContentMarginWrapper.vue'

export default defineNuxtPlugin(({ vueApp }) => {
  vueApp.component('Content', Content)
  vueApp.component('ContentMarginWrapper', ContentMarginWrapper)
})

// layers/content/nuxt.config.ts (excerpt)
hooks: {
  'components:dirs': (dirs) => {
    const layerComponentsRoot = fileURLToPath(new URL('./app/components', import.meta.url))
    for (const [index, entry] of dirs.entries()) {
      const normalized = typeof entry === 'string' ? { path: entry } : { ...entry }
      if (normalized.path?.startsWith(layerComponentsRoot)) {
        normalized.extensions = ['vue']
        dirs[index] = normalized
      }
    }
  },
  'components:extend': (components) => {
    const runtimeDir = fileURLToPath(new URL('./app/components/runtime', import.meta.url))
    const builderDir = fileURLToPath(new URL('./app/components/builder', import.meta.url))
    for (let i = components.length - 1; i >= 0; i--) {
      const filePath = components[i].filePath
      if (filePath.startsWith(runtimeDir) || filePath.startsWith(builderDir)) {
        components.splice(i, 1)
      }
    }
  }
}
```
