## Initial Prompt
Try that yes

## Implementation Summary
Implementation Summary: Fixed the database layer register-layout module so it exports a proper Nuxt module and applies the layer-wide layout in a pages:extend hook.

## Documentation Overview
- The module now uses `defineNuxtModule` and sets page meta layout for files under the database layer root.

## Implementation Examples
```ts
export default defineNuxtModule({
  setup(_options, nuxt) {
    nuxt.hook('pages:extend', (pages) => {
      const layout = nuxt.options.appConfig?.uiNavigation?.adminLayout || 'default'
      // apply layout to layer pages
    })
  },
})
```
