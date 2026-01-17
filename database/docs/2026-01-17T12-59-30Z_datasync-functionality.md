## Initial Prompt
Implement the specs in layers/database/docs/datasync_functionality.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
Implementation Summary: Built the Data Sync banner form with local-storage-backed credentials, added client-side _all_dbs fetching with Basic Auth and table rendering, and documented the spec progress plus VueUse dependency requirements.

## Documentation Overview
- `layers/database/pages/admin/datasync.vue` now renders the HTTPS host + credentials banner and a results table for `_all_dbs`.
- Credentials persist in local storage via `useLocalStorage` and the fetch runs on the client with Basic Auth.
- `layers/database/docs/datasync_functionality.md` is updated with completed checklist items.

## Implementation Examples
```ts
const host = useLocalStorage('database-datasync-host', '')
const username = useLocalStorage('database-datasync-username', '')
const password = useLocalStorage('database-datasync-password', '')
```
```ts
const response = await fetch(`${normalizedHost}/_all_dbs`, {
  headers: { Authorization: `Basic ${btoa(`${username}:${password}`)}` },
})
```
