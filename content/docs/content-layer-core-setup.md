# Content Layer Core Setup

## Initial Prompt
```
Proceed with the plan. Inside content_layer.md, remove the raw excalidraw data and put in the parsed information. Then use the file with progress markers.
```

## Implementation Summary
Scaffolded new content layer with CouchDB init, content design doc, CRUD APIs, and Pinia/composable client utilities.

## Documentation Overview
- Added a new `content` layer that extends the shared database utilities, validates `dbLoginPrefix`, and exposes composables and stores through Nuxt auto-imports.
- Introduced a CouchDB initialization plugin that provisions `${dbLoginPrefix}-content` and registers the `_design/content` design document with a `by_path` view to query pages by URL.
- Implemented server API endpoints under `/api/content/pages` to list pages, fetch by path, and perform admin-gated create/update mutations backed by CouchDB helpers.
- Provided reusable helpers for path normalization, database name resolution, and admin-session enforcement to keep API handlers concise.
- Delivered a Pinia store plus composables for reactive page/index fetching and mutation helpers suitable for admin interfaces or public content rendering.
- Manual verification plan: run the consuming app with `npm run dev`, ensure CouchDB env vars plus `dbLoginPrefix` are set, then call the `/api/content/pages` endpoints (list, `?path=`) and exercise the Pinia store actions via browser devtools or component usage.

## Implementation Examples
```ts
// Fetch and cache the full page index
const { pages, pending, refresh } = useContentPagesIndex()
await refresh()

// Load a specific page reactively in a component
const { page, pending: pageLoading } = useContentPage('/welcome')

// Create a new page via the store (admin context)
const contentStore = useContentPagesStore()
await contentStore.createPage({
  path: '/about',
  title: 'About Us',
  content: { hero: 'Welcome', body: 'Static content blocks' }
})
```
