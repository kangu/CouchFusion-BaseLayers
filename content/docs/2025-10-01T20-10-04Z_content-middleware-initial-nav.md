## Initial Prompt
```
I restarted the server but the fetch still happens twice
```

## Implementation Summary
Avoided duplicate client fetches by returning early when the content middleware runs without a previous route during hydration.

## Documentation Overview
- Simplified the guard in `app/middleware/content.global.ts` to check `from` on the client, ensuring the middleware only executes once during SSR and skips the immediate client hydration run.
- Subsequent client navigations still trigger the middleware, preserving prefetch behaviour while eliminating redundant network calls on first load.

## Implementation Examples
```ts
export default defineNuxtRouteMiddleware(async (to, from) => {
  if (import.meta.client && !from) {
    return
  }

  // continue with content fetch logic
})
```
