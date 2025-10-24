## Initial Prompt
```
Evaluate the http://localhost:7833/sitemap.xml url with the playwright mcp server to determine if the /builder is present there (it should not be as it's inside manualIgnoredPrefixes). Implement the cleanest fix that makes the configuration read and applied properly
```

## Implementation Summary
Implementation Summary: Normalized the content layer ignored-prefixes module to keep manual overrides, moved radustanciu's manual ignored list into Nuxt appConfig, and confirmed the sitemap omits /builder via Playwright.

## Documentation Overview
- Updated `layers/content/utils/ignored-prefixes.server.ts` to normalise auto prefixes once, reapply them through an `applyContentConfig` helper, and hook into `app:config` so consumer-provided `manualIgnoredPrefixes` persist after layer initialisation.
- Ensured manual and auto ignore vectors surface alongside the merged list without clobbering other `content` configuration entries, so downstream utilities like `resolveIgnoredPrefixes` receive the expected data.
- Verified the sitemap generator now consumes the corrected manual prefixes, keeping editor-only routes out of the published XML.

## Implementation Examples
```ts
const applyContentConfig = (contentConfig: Record<string, any> | undefined | null) => {
  const manualPrefixesInput =
    contentConfig?.manualIgnoredPrefixes ??
    contentConfig?.manualPrefixes ??
    []

  const manualNormalised = normalisePrefixList(manualPrefixesInput)

  const merged = Array.from(
    new Set<string>([...autoNormalised, ...manualNormalised])
  ).sort((a, b) => a.localeCompare(b))

  return {
    ...contentConfig,
    autoIgnoredPrefixes: autoNormalised,
    manualIgnoredPrefixes: manualNormalised,
    ignoredPrefixes: merged
  }
}
```
```ts
nuxt.hook('app:config', (appConfig: any) => {
  appConfig.content = applyContentConfig(appConfig.content)
})
```
