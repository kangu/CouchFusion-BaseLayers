## Initial Prompt
Implement the new specs in layers/database/docs/datasync_functionality.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Added a database info proxy endpoint for remote CouchDB instances, updated the Data Sync UI to fetch per-database stats sequentially, and rendered inline loading indicators while each row resolves.

## Documentation Overview
- Added `/api/datasync/db-info/:db_name` to fetch detailed database metadata from the remote host with admin auth.
- Data Sync table now includes docs, size metrics, update sequence, and instance start time, with per-cell loading states.
- Updated the spec progress checklist.

## Implementation Examples
```ts
const info = await $fetch(`/api/datasync/db-info/${encodeURIComponent(dbName)}`, {
  method: 'POST',
  body: { host, username, password },
})
```
