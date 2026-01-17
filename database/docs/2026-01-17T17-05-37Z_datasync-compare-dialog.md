## Initial Prompt
Alongside "Replicate Down", provide functionality through a server api function to compare the documents from a database, between local and remote. Provide a html dialog to highlight the changes in a table that lists all documents and their revisions and whether they are or not in the local/remote db.

## Implementation Summary
Implementation Summary: Added a compare-docs API for local/remote _all_docs comparisons and wired a searchable, paginated HTML dialog to display per-document revision status.

## Documentation Overview
- `/api/datasync/compare-docs` returns status-tagged doc ids with pagination and counts.
- Data Sync UI now offers a Compare Docs dialog with search, pagination, and status listing.

## Implementation Examples
```ts
await $fetch('/api/datasync/compare-docs', { method: 'POST', body: { dbName, host, username, password } })
```
