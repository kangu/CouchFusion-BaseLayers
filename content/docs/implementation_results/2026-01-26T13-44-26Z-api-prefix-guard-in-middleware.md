## Initial Prompt
Add the `/api` guard once in the content layer’s route middleware so page components don’t need to duplicate the `startsWith('/api/')` check.

## Plan
1. Locate the shared content route middleware and identify where ignored prefixes are applied.
2. Add a reserved `/api` guard that aborts navigation with a 404 before content fetching runs.
3. Note the change in layer docs for downstream apps.

## Implementation Summary
- Updated `layers/content/app/middleware/content.global.ts` to intercept any `/api` page navigation and abort with a 404 (“API endpoint not found”), keeping API namespace reserved without requiring per-app checks in catch-all pages.
- The guard runs before content fetch logic and leverages the existing ignored-prefixes setup; consuming apps inherit the behavior automatically.

## Next Steps
- If additional reserved namespaces emerge, add them to this middleware (or `RESERVED_CONTENT_PREFIXES`) to keep page-layer handling aligned.
- Optionally add an e2e assertion that a client-side visit to `/api/whatever` returns a 404 page response.
