# App Config Content Ignore Routes

## Initial Prompt
```
Implement this approach into the bitvocation-demo app and remove  '/dashboard',
    '/members' as predefined from content.global.ts
```

## Implementation Summary
Content middleware now merges runtime app-configured ignore prefixes with built-in defaults, and a content-layer Nuxt module computes the app-provided ignore list by scanning static pages and combining them with manual overrides exposed via app config.

## Documentation Overview
- Middleware now requests `content.ignoredPrefixes` from `useAppConfig()`, normalises the values, and folds them into the fixed system prefixes before evaluating a route. This keeps the layer generic while allowing each consuming application to provide bespoke exclusions.
- The new `utils/ignored-prefixes.ts` Nuxt module runs during setup, inspects the consuming app's `/pages` directory, filters static entries, normalises the prefixes, and merges them with any `appConfig.content.manualIgnoredPrefixes`.
- Hard-coded app-specific routes were removed from the layer; any exclusions beyond the shared defaults are now supplied via configuration rather than bespoke middleware edits.

## Implementation Examples
```ts
// layers/content/app/middleware/content.global.ts
const buildIgnoredPrefixes = (): string[] => {
  const appConfig = useAppConfig()
  const appDefined = Array.isArray(appConfig?.content?.ignoredPrefixes)
    ? appConfig.content.ignoredPrefixes
    : []

  const combined = new Set<string>(reservedPrefixes)

  for (const prefix of appDefined) {
    const normalised = typeof prefix === 'string' ? normalisePrefix(prefix) : null
    if (normalised) {
      combined.add(normalised)
    }
  }

  return Array.from(combined)
}
```

```ts
// layers/content/utils/ignored-prefixes.ts
const merged = Array.from(
  new Set([...autoNormalised, ...manualNormalised])
).sort((a, b) => a.localeCompare(b))

nuxt.options.appConfig.content = {
  ...contentConfig,
  autoIgnoredPrefixes: autoNormalised,
  manualIgnoredPrefixes: manualNormalised,
  ignoredPrefixes: merged
}
```
