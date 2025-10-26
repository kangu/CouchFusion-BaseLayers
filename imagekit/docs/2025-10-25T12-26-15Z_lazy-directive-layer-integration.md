# Initial Prompt
```
Move the lazy.ts plugin from "bitvocation" to the content layer and always load it when the content layer is extended
```

# Plan
1. Create a shared lazy directive plugin inside the content layer, copying the existing implementation.
2. Register the plugin in `layers/content/nuxt.config.ts` and ensure the layer extends the ImageKit layer so the `#imagekit` alias resolves.
3. Remove the app-specific plugin from `apps/bitvocation` to avoid duplicate registrations.

# Next Steps
- Remove the duplicated lazy plugin from other apps (e.g. `bitvocation-demo`) once they adopt the shared layer version.
- Verify lazy-loaded images still resolve correctly while the dev server on port 3012 hot-reloads content changes.

# Implementation Summary
Relocated the ImageKit-aware lazy directive into the content layer, auto-registering it alongside the layer and inheriting the ImageKit alias for Nuxt 4 compatibility.

# Documentation Overview
- `layers/content/app/plugins/lazy.ts` now exposes the `v-lazy` directive across all consuming apps.
- `layers/content/nuxt.config.ts` extends the shared ImageKit layer and registers the new plugin so it loads whenever the content layer is used.
- The application-specific plugin in `apps/bitvocation` was removed; consuming apps no longer need local copies.

# Implementation Examples
```ts
// layers/content/nuxt.config.ts
extends: ["../database", "../imagekit"],
plugins: [
  fileURLToPath(new URL("./app/plugins/register-project-content-components", import.meta.url)),
  fileURLToPath(new URL("./app/plugins/lazy", import.meta.url)),
]
```

```ts
// layers/content/app/plugins/lazy.ts (excerpt)
const defaultEndpoint =
  runtimeConfig.public?.imagekit?.urlEndpoint || runtimeConfig.imagekit?.urlEndpoint

nuxtApp.vueApp.directive('lazy', {
  getSSRProps(binding) {
    return { src: PLACEHOLDER_SRC, 'data-lazy-src': binding.value ?? '' }
  },
  mounted(el, binding) {
    const targetSrc = computeTargetSrc(el, binding.value)
    // ...
  },
})
```
