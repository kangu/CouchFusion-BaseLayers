## Initial Prompt
Use color coding for the table rows... use light green when doc count is in sync. Use light red when local db is missing, and light teal when local > remote, light orange remote < local

## Implementation Summary
Implementation Summary: Added row-level color coding based on local/remote doc_count comparison, with replication state taking precedence over sync status.

## Documentation Overview
- Rows now show green for in-sync counts, red when local DB is missing, teal when local > remote, and orange when remote > local.
- Replication-active rows use an amber tint to override other statuses.

## Implementation Examples
```ts
if (localCount === remoteCount) return 'bg-green-50'
if (localCount > remoteCount) return 'bg-teal-50'
if (remoteCount > localCount) return 'bg-orange-50'
```
