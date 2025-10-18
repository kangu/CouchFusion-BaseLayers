## Initial Prompt
```
When the content.global.ts middleware fails to find a page using await store.fetchPage(to.path), so that it returns 404, make sure to render a 404 page on the browser, for both server and client navigation.
```

## Implementation Summary
Surface content fetch 404s through Nuxt error handling so the browser renders the 404 page during SSR and client navigation.

## Documentation Overview
- Updated `app/middleware/content.global.ts` to call `abortNavigation(createError({...}))` when `fetchPage` throws a 404, ensuring Nuxt renders its 404 error page consistently.
- Non-404 errors continue to log for debugging while allowing navigation to bubble up as before.

## Implementation Examples
```ts
try {
  await store.fetchPage(to.path)
} catch (error: any) {
  if (error?.statusCode === 404) {
    return abortNavigation(createError({
      statusCode: 404,
      statusMessage: 'Content page not found'
    }))
  }

  console.error('Content middleware fetch error:', error)
}
```
```ts
// Client navigation still triggers the middleware; if the page is missing the Nuxt error layout shows
await navigateTo('/missing-page')
```
