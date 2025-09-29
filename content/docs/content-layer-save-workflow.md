# Content Layer Save Workflow

## Initial Prompt
```
- Wire a save workflow that persists the builder’s document back through the content APIs once the contract is finalised.
- Expose document metadata (e.g., last updated timestamps) in the admin UI to help editors understand recency.
```

## Implementation Summary
- Added shared utilities to transform between minimal builder documents and the `ContentPageDocument` shape, reusing them across client and server layers.
- Updated the content API POST/PUT handlers to accept full `ContentPageDocument` payloads, sanitising/normalising before persistence and maintaining CouchDB metadata.
- Extended `useContentPagesStore` with a `saveDocument` action that posts complete documents to the API, refreshing caches and index entries.
- Exposed a `getSerializedDocument` helper from `BuilderWorkbench` and introduced a Save workflow on `/admin/content` that serialises the current builder state, persists it, and surfaces last-updated metadata.

## Verification
1. With the dev server running on port 9000 (per project defaults), open `/admin/content` as an admin user.
2. Select a page, make an edit, and click “Save Changes”; confirm the request succeeds and the “Last updated” indicator reflects the new timestamp.
3. Create a new page via the modal, ensure it appears in the tab list, then modify and save to confirm both create and update paths persist correctly.
