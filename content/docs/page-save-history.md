# Page Save History

## Initial Prompt
Implement the specs in layers/content/docs/specs/page_save_history.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Enabled page history by copying saved documents into CouchDB oldpage entries, exposing an API, and wiring the admin builder to load the latest three revisions.

## Documentation Overview
- Added a CouchDB view that indexes `oldpage-*` documents by `{path, timestamp}` so history queries can pull the latest revisions per page and prune older copies.
- Persisted history entries after each save via the `savePageHistory` helper, which clones the saved document, stores it under an `oldpage-` id, and trims the set to three.
- Exposed a `GET /api/content/pages/history` endpoint returning minimal documents so the UI can hydrate the builder with prior revisions.

## Implementation Examples
- `layers/content/utils/design-documents.ts:12` – registers the `history_by_path` map view for fetching and pruning page history rows.
- `layers/content/server/utils/page-history.ts:5` – centralises history persistence, cloning saved documents and deleting surplus snapshots.
- `layers/content/server/api/content/pages.put.ts:6` – invokes the history helper after each save to keep historical revisions aligned with the latest document.
- `layers/content/server/api/content/pages/history.get.ts:1` – serves the page history list used by the admin interface.
