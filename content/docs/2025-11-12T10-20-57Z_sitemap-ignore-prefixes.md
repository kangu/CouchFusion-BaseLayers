# Sitemap Ignored Prefixes Fix

## Initial Prompt
```
The layers/content/server/api/sitemap.xml.get.ts does not read the ignoredPrefixes from the app.config.ts file (from the bitvocation app). Investigate why and fix
```

## Implementation Summary
Updated the sitemap endpoint to consume the merged `content.ignoredPrefixes` set (auto + manual) from `app.config`, ensuring routes like `/builder` defined in the host app config stay out of `sitemap.xml`.

## Documentation Overview
- `layers/content/server/api/sitemap.xml.get.ts` now calls `resolveIgnoredPrefixes(appConfig?.content)` with default options instead of forcing `includeMerged: false`, so any prefixes produced by the ignored-prefixes Nuxt module (manual, auto, merged) flow into the sitemap filtering logic.
- Removed the leftover debug `console.log` during sitemap generation.
- No other behaviour changed: static/extra/content routes still merge into the sitemap, but app-specific exclusions are honored.

## Implementation Examples
```ts
const appConfig = useAppConfig()
const ignoredPrefixes = resolveIgnoredPrefixes(appConfig?.content)
```
```diff
- const ignoredPrefixes = resolveIgnoredPrefixes(appConfig?.content, {
-   includeAuto: false,
-   includeMerged: false,
- })
- console.log('Ignoring', ignoredPrefixes)
+ const ignoredPrefixes = resolveIgnoredPrefixes(appConfig?.content)
```
