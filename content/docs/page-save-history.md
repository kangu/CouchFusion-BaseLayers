# Page Save History

## Initial Prompt
Implement the specs in layers/content/docs/specs/page_save_history.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Enabled page history by copying saved documents into CouchDB local documents, exposing an API, and wiring the admin builder to load the latest five revisions.

## Documentation Overview
- History snapshots are stored as CouchDB `_local` documents so they stay out of normal page views and replication-oriented document listings.
- Persisted history entries after each save via the `savePageHistory` helper, which clones the saved document, stores it under an `_local/page-...-{timestamp}` id, and trims the set to five.
- A per-page `_local/page-history-index-...` document tracks snapshot ids because `_local` documents are not queryable through design-doc views.
- Exposed a `GET /api/content/pages/history` endpoint returning minimal documents so the UI can hydrate the builder with prior revisions.

## Implementation Examples
- `layers/database/utils/couchdb.ts:362` - provides shared `_local` document read/write/delete helpers.
- `layers/content/server/utils/page-history.ts:5` - centralises history persistence, cloning saved documents, updating the local index, and deleting surplus snapshots.
- `layers/content/server/api/content/pages.put.ts:6` – invokes the history helper after each save to keep historical revisions aligned with the latest document.
- `layers/content/server/api/content/pages/history.get.ts:1` – serves the page history list used by the admin interface.
