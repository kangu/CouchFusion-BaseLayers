# Auto Register Content Components

## Initial Prompt
```
The plugins/dynamic-content-components.ts is currently used in bitvocation-demo app for registering the custom components for the content module. Provide a way to automatically register all components from /components/content showhow, ideally from the content layer but accessing the components from the implementing app.
```

## Implementation Summary
Added a shared plugin that inspects the consuming app's `components/content` directory, derives component names, and registers each as an async Vue component (with kebab-case aliases) so dynamic content rendering works without per-app plugins.

## Documentation Overview
- `plugins/register-project-content-components.ts` now runs from the content layer, using `import.meta.glob` to discover `~/components/content/**/*.{vue,ts,js,jsx,tsx}` files, convert their paths into PascalCase identifiers, and register them lazily on the Nuxt Vue app.
- The plugin defensively checks for existing registrations before adding components, allowing apps to override specific entries if required.
- Combined with the ignored-prefix module, consuming apps only need to organise their content components under `components/content`; the layer handles registration automatically.
- The layer's `nuxt.config.ts` lists the registration plugins explicitly so both Nuxt 3 and Nuxt 4 load them from the same location with no duplicate files.

## Implementation Examples
```ts
const registrations: ComponentRegistration[] = Object.keys(componentModules)
  .map((path) => deriveComponentName(path))
  .filter((entry): entry is ComponentRegistration => Boolean(entry))

export default defineNuxtPlugin((nuxtApp) => {
  for (const registration of registrations) {
    const asyncComponent = defineAsyncComponent(registration.loader)

    if (!nuxtApp.vueApp.component(registration.name)) {
      nuxtApp.vueApp.component(registration.name, asyncComponent)
    }

    for (const alias of registration.aliases) {
      if (!nuxtApp.vueApp.component(alias)) {
        nuxtApp.vueApp.component(alias, asyncComponent)
      }
    }
  }
})
```
