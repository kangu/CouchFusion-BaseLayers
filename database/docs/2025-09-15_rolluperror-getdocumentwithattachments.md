# RollupError Fix: getDocumentWithAttachments

## Initial Prompt
Check all places where getDocumentWithAttachments is used and make sure the code you implement is compatible with that

## Implementation Summary
Implemented a shared `getDocumentWithAttachments` helper in `layers/database/utils/couchdb.ts` that fetches CouchDB documents with optional inline attachment data and 404 handling, ensuring compatibility with clients attachment APIs expecting a boolean flag.

## Documentation Overview
- Added a CouchDB utility that wraps document retrieval with optional `attachments=true`/`att_encoding_info=true` query parameters, falling back to metadata-only reads when inline data is not requested.
- The helper mirrors existing `getDocument` semantics (returning `null` on 404, logging on failure) while preserving the prior call signature used across clients attachment API handlers.
- This ensures attachment listing, upload, and deletion routes can continue to request revision metadata without changes.

## Implementation Examples
```ts
// Fetch document metadata plus attachment stubs
const clientDoc = await getDocumentWithAttachments('paca-events', clientId)

// Fetch document with inline attachment payloads when needed
const clientDocWithData = await getDocumentWithAttachments('paca-events', clientId, true)
```
