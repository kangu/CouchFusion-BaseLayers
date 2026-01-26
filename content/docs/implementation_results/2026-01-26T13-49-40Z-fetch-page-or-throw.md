## Initial Prompt
Refactor the fetchPage call from the slug page into the content store/composable to minimize surface in implementing apps.

## Plan
1. Add a store-level helper that wraps `fetchPage` and throws a 404 when no summary is returned.
2. Create a shared composable that handles async fetch + live cache resolution so page components don’t reimplement the merge logic.
3. Update consuming slug pages to use the helper/composable and document the change.

## Implementation Summary
- Added `fetchPageOrThrow` to `useContentPagesStore`, reusing `fetchPage` but raising a 404 via `createError` when the response is empty.
- Introduced `useContentPageDocument` to fetch via the store, merge live updates, and emit a minimal document/summary while still throwing a 404 if the resolved document is missing.
- Updated the CouchFusion catch-all page to rely on the new helper/composable, removing local fetch/404 and live-summary boilerplate.

## Next Steps
- Migrate other apps’ catch-all pages to the helper/composable for consistent behavior.
- Consider an e2e assertion that missing content paths still surface a 404 through the page route.
