# Pacanele Dashboard Content Integration

## Initial Prompt
Implement the content module inside the app and provide a /content route where page data can be managed. Check the bitvocation-demo app for a sample implementation of that and replicate the functionality there. Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.

## Implementation Summary
Extended the Pacanele Dashboard app to consume the shared content layer: added `@nuxt/content`, configured filesystem + database sources, and exposed the admin workbench at `/content` with authentication, matching the bitvocation-demo pattern.

## Documentation Overview
- App now extends `../../layers/content` and registers the Nuxt Content module to synchronize page data via the shared CouchDB-backed content layer.
- `content.config.ts` defines the default markdown page collection, enabling the builder to manage entries stored in `/content`.
- The `/content` page wraps `ContentAdminWorkbench` with project-specific toast handlers and FlyonUI classes while remaining behind the standard `auth` middleware.

## Implementation Examples
```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['../../layers/database', '../../layers/auth', '../../layers/content'],
  modules: ['@pinia/nuxt', '@nuxt/content'],
  content: {
    documentDriven: false,
    database: true,
    driver: 'fs',
    sources: {
      content: {
        driver: 'fs',
        prefix: '/',
        base: './content'
      }
    }
  }
})
```
