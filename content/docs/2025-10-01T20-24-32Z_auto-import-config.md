## Initial Prompt
```
I get the error useContentPagesStore is not defined. Shouldn't it be auto imported from the content layer?
```

## Implementation Summary
Registered the content layer's composables and stores directories with absolute paths so Nuxt auto-imports `useContentPagesStore` into consuming apps.

## Documentation Overview
- Updated `layers/content/nuxt.config.ts` to pass absolute paths (via `fileURLToPath`) to `imports.dirs`, ensuring Nuxt loads the layer’s composables and stores for auto import generation.
- Regenerated project types (`bunx nuxi prepare`) so `.nuxt/imports.d.ts` now exports `useContentPagesStore`, resolving runtime “not defined” errors for consuming apps.

## Implementation Examples
```ts
// nuxt.config.ts (content layer)
imports: {
  dirs: [
    fileURLToPath(new URL('./app/composables', import.meta.url)),
    fileURLToPath(new URL('./app/stores', import.meta.url))
  ]
}
```
```ts
// App code can now rely on auto-import
const contentStore = useContentPagesStore()
```
