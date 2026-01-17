## Initial Prompt
Use solution 2

## Implementation Summary
Implementation Summary: Added a database-layer server endpoint to proxy `_all_dbs` requests with admin auth, and updated the Data Sync page to call the local API instead of hitting CouchDB directly, avoiding CORS failures.

## Documentation Overview
- New `/api/datasync/remote-dbs` endpoint validates HTTPS host + credentials and performs the remote request with Basic Auth server-side.
- Data Sync UI now posts to the local proxy, preserving the existing table rendering and local storage fields.

## Implementation Examples
```ts
const response = await $fetch('/api/datasync/remote-dbs', {
  method: 'POST',
  body: { host, username, password },
})
```
