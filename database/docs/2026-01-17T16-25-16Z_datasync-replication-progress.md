## Initial Prompt
When starting replication on a table row, put that row in progress mode and update the progress to received statuses. When the final state reaches "completed", stop the watch handler. And do a refresh on the db-info for that given database.

## Implementation Summary
Implementation Summary: Added replication progress state per row, stop polling on completion, and refresh the db-info data once replication finishes.

## Documentation Overview
- Replication status polling now stops when CouchDB reports `completed`, and the row’s db-info is refreshed immediately.
- Rows display an in-progress hint while replication is active.

## Implementation Examples
```ts
if (status?.state === 'completed') {
  stopReplicationPolling(dbName)
  await refreshDbInfoForDb(dbName)
}
```
