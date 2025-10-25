## Initial Prompt
```
Make the nagivation between pages inside the content builder stay in sync with the url and the navigation history. So when starting on /builder/razvan, then clicking on the / page, the url should change to /builder/. When clicking on the /test1 route, the url should change to /builder/test1
```

## Implementation Summary
Implementation Summary: Synced InlineLiveEditor selections with builder routes via history state updates, keeping `/builder` and `/k` URLs aligned without triggering full navigations.

## Documentation Overview
- Enhanced `InlineLiveEditor` with router awareness, tracking the active builder base (`/builder` or `/k`) and applying `history.pushState` updates when editors switch pages instead of initiating Nuxt navigations.
- Normalised builder targets to trim leading slashes and collapse the homepage into the base path, preventing stray double slashes.
- Added guard logic so SSR execution skips router updates and duplicate navigations are ignored, avoiding console noise while still surfacing unexpected errors.

## Implementation Examples
```ts
const builderBasePath = computed(() => {
  const segments = (route.path || '/builder').split('/').filter(Boolean)
  return segments[0] === 'k' ? '/k' : '/builder'
})
```
```ts
const current = window.location.pathname + window.location.search + window.location.hash

if (current === targetPath) {
  return
}

window.history.pushState(null, "", targetPath)
```
