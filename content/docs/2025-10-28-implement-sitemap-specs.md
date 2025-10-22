# Implement Sitemap Specs

## Initial Prompt
```
Implement the specs in layers/content/docs/sitemap.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification. Present implementation plan before proceeding on my instructions.
```

## Implementation Summary
Added build-time static route harvesting and a Nitro handler exposing `/api/sitemap.xml` that merges static pages, CouchDB-backed content, and optional app-configured entries while respecting content ignore rules.

## Documentation Overview
- `utils/sitemap-routes.ts` scans the consuming app's `/pages` tree during init/build hooks, persists the deduplicated static paths, and exposes them through both runtime config and a build artifact for runtime consumption.
- A new server handler `server/api/sitemap.xml.get.ts` produces the XML sitemap by combining static routes, content documents queried from the `content/by_path` view, and `app.config.ts` `sitemapExtraRoutes`, filtering against reserved/manual prefixes and metadata flags.
- Shared utilities in `utils/content-route.ts` centralise prefix normalisation and the `isContentRoute` guard so middleware and sitemap generation follow identical inclusion logic.
- The ignored-prefix utilities now allow consumers to exclude automatic page-derived prefixes when building the sitemap, so manually declared paths remain opt-in while middleware continues to skip static routes.
- The sitemap response derives its origin from `runtimeConfig.public.siteUrl` (falling back to request headers), emits ISO timestamps when available, and disables caching for accurate hot reload behaviour.

## Implementation Examples
```ts
// apps/bitvocation-demo/app.config.ts
export default defineAppConfig({
  content: {
    sitemapExtraRoutes: [
      '/careers',
      { path: '/legal/terms', lastmod: '2024-10-01T00:00:00.000Z' }
    ]
  }
})
```

```ts
// Runtime fetch example
const { data } = await useFetch('/api/sitemap.xml', { responseType: 'text' })
console.log(data.value)
```
