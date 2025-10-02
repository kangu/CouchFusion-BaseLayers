## Initial Prompt
```
How do I make sure that the content.global.ts middleware from the content layer executes only once on the server, then on each client navigation. Currently, on the first render, it executes both on the server and on the client, which means it fetches the data twice
```

## Implementation Summary
Prevented duplicate initial hydration fetch by skipping the content middleware when Nuxt is hydrating on the client.

## Documentation Overview
- Updated `app/middleware/content.global.ts` to detect initial client hydration via `nuxtApp.isHydrating` and return early so the server-side fetch isn't repeated.
- The middleware still evaluates content routes on SSR and on subsequent client navigations, preserving the prefetch behaviour without redundant API calls.

## Implementation Examples
```ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.client) {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.isHydrating && !from) {
      return
    }
  }

  // existing content routing logic
})
```
```ts
// Store fetch still occurs when middleware runs
await store.fetchPage(to.path)
```
