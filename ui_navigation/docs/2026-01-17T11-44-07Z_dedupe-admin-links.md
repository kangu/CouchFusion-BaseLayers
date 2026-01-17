## Initial Prompt
I have many data sync entries in the Bitvocation app. Investigate why. Apply the de-dupe fix

## Implementation Summary
Implementation Summary: Added de-duplication to the shared sidebar navigation builder so repeated layer-provided sections/items collapse into a single entry when Nuxt merges appConfig arrays.

## Documentation Overview
- Dedupe logic merges sections by id/title and items by route to prevent duplicate admin links when multiple layers extend the same base layer.

## Implementation Examples
```ts
const mergedSections = dedupeSections([...baseSections, ...configuredSections])
```
