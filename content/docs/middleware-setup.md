# Content Middleware Setup

## Specification Summary
- Implement a global middleware that executes for every route on apps extending the content layer.
- Middleware must run in both client and server contexts and call the content Pinia store to load the current URL's page document.
- Ensure the middleware executes before page components render so that content data is available ahead of time.
- Reuse the Pinia store's caching capabilities to return already-fetched documents instantly on subsequent navigations.

## Progress Checklist
- [x] Global middleware registered to run on every navigation (client + server)
- [x] Middleware fetches current path's content via store prior to rendering
- [x] Store caching validated/extended to guarantee immediate reuse
- [x] Documentation artifacts updated with implementation summary and examples
- [x] Manual verification steps recorded
