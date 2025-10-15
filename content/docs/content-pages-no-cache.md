# Content Pages No Cache

## Initial Prompt
When running requests for /api/content/pages?path= or /api/content/pages/history?path=, make sure there is no caching involved and the latest resource is always retrieved.

## Implementation Summary
Content page and history endpoints now emit no-cache headers, and the store fetchers add cache-busting params plus headers so each request hits the latest CouchDB data.

## Documentation Overview
- Server handlers for `/api/content/pages` and `/api/content/pages/history` now set `Cache-Control`, `Pragma`, and `Expires` headers to disable intermediary caching.
- The Pinia content pages store appends a timestamp query parameter and no-cache headers when requesting individual pages or history entries, ensuring the browser bypasses cached responses.
- Existing index caching behaviour in the store remains, so downstream components can still rely on memoised summaries while path/history lookups always hit the server freshly.

## Implementation Examples
```ts
setResponseHeader(event, 'Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
setResponseHeader(event, 'Pragma', 'no-cache')
setResponseHeader(event, 'Expires', '0')
```

```ts
const cacheBuster = Date.now().toString()
const response = await $f('/api/content/pages', {
  params: { path: normalizedPath, _ts: cacheBuster },
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache'
  }
})
```
