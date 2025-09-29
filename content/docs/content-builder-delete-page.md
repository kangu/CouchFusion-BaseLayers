# Content Builder Delete Page

## Initial Prompt
Alongside Save Changes in the content builder, add the possibility of deleting a page. Ask for confirmation before deleting. Delete operation should actually delete the couchdb doc associated with the page.

## Implementation Summary
Added a server/API pipeline and UI controls so editors can confirm and delete the current page directly from the builder, including removal from CouchDB and store state.

## Documentation Overview
- Created a `DELETE /api/content/pages` handler that validates admin sessions, looks up the target document, and removes it from CouchDB using a new `deleteDocument` helper.
- Extended the content pages store with a `deletePage` action that updates in-memory indexes after the backend call succeeds.
- Enhanced the admin builder header with a destructive delete button that confirms intent, triggers the removal flow, refreshes the page index, and gracefully resets the selection.
- Refreshed checkbox styling across the node editor to use FlyonUI-inspired controls while restyling array toolbars for a cohesive action row.

## Implementation Examples
- `layers/database/utils/couchdb.ts:523` – new `deleteDocument` helper wraps the CouchDB delete call.
- `layers/content/server/api/content/pages.delete.ts:1` – server endpoint deletes content docs after permission checks.
- `layers/content/app/stores/pages.ts:233` – store action removes deleted pages from the local cache and index.
- `apps/bitvocation-demo/pages/admin/content.vue:330` – builder header now surfaces a confirmed delete button alongside save.
