# Sitemap Root Alias

## Initial Prompt
```
How can I most easily render the /api/sitemap.xml route under /sitemap.xml, ideally without having to do any project-specific config
```

## Implementation Summary
Added a layer-level route alias so `/sitemap.xml` maps to the existing sitemap handler, eliminating the need for per-app configuration.

## Documentation Overview
- `server/routes/sitemap.xml.ts` re-exports the API handler so Nitro serves the sitemap from both `/api/sitemap.xml` and `/sitemap.xml`.
- Because the change lives in the shared content layer, every app extending the layer automatically gains the root-level sitemap route.

## Implementation Examples
```ts
// layers/content/server/routes/sitemap.xml.ts
export { default } from "../api/sitemap.xml.get";
```
