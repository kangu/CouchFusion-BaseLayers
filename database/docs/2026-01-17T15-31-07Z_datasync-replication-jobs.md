## Initial Prompt
Add a Replicate Down button at the end of the table line (in an Actions column). The function should trigger an api endpoint to start a replication from the remote host to the local host. Evaluate ways to show progress on the couchdb replication.

## Implementation Summary
Implementation Summary: Added replication endpoints backed by CouchDB _replicator and _active_tasks, and wired a per-row Replicate Down action with live status, errors, and warnings in the Data Sync table.

## Documentation Overview
- `POST /api/datasync/replicate` creates or updates a _replicator document per database.
- `GET /api/datasync/replication-status/:db_name` reads the _replicator doc and active tasks to report progress and issues.
- The Data Sync table includes an Actions column with a Replicate Down button and status feedback.

## Implementation Examples
```ts
await $fetch('/api/datasync/replicate', { method: 'POST', body: { host, username, password, dbName } })
```
