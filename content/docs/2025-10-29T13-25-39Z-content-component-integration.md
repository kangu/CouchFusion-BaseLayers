# Initial Prompt
Inside layers/content/docs/extracted_component there is a component that I want to use instead of <ContentRenderer> for page rendering. Provide the step by step guide of integrating that into the host app so it's automatically available on all pages. Check the current /components folder structure in the content layer and propose the best solution for integration. Rename the component everywhere from ContentRenderer to Content so it doesn't conflict with the @nuxt/content module. Proceed with the integration steps as you laid them out.

# Implementation Summary
Embedded the extracted renderer into the content layer as a global `<Content>` component, updating consuming apps to render with it and avoiding collisions with @nuxt/content.

# Documentation Overview
- Moved the extracted renderer runtime into `app/components/runtime/content`, renaming the entry file to `Content.vue` and carrying across the supporting minimark helpers and case utilities.
- Declared `minimark` as a direct dependency of the content layer and exposed the new component (plus helpers) via `app/components/runtime/index.ts` for optional import-based usage.
- Added HTML element detection (including `<template>` → fragment handling) so native tags bypass Vue component resolution without emitting console warnings.
- Normalized child rendering so component slots receive function defaults, avoiding Vue's SSR warnings about non-function default slots.
- Cleaned up the catch-all pages and builder preview to render `<Content>` so every consuming app uses the shared component while the layer’s global component registration keeps it auto-available.

# Implementation Examples
- Rendering a minimal document inside a catch-all page now uses the layer component by name:
  ```vue
  <Content v-if="pageDocument" :value="pageDocument" />
  ```
- To use the helpers directly in custom tooling:
  ```ts
  import { decompressTree, compressTree } from '#content/app/components/runtime/content'
  ```
