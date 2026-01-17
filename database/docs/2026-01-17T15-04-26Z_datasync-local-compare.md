## Initial Prompt
The /db-info endpoint should also check the db info for the local database with that name (if exists) - by looking at http://localhost:5984 with the local admin credentials. The info data for # docs and update seq should be highlighted when there is a different between the two instances.

## Implementation Summary
Implementation Summary: Extended the db-info endpoint to fetch both remote and local CouchDB metadata, and updated the Data Sync UI to render stacked local/remote values with mismatch highlighting for doc counts and update sequences.

## Documentation Overview
- `/api/datasync/db-info/:db_name` now returns `{ local, remote }` payloads by querying the runtime-configured CouchDB and remote host.
- Data Sync table renders local values on top of remote values and highlights both when they differ.

## Implementation Examples
```ts
const [remoteInfo, localInfo] = await Promise.all([
  fetchDbInfo(normalizedHost, remoteAuthHeader, dbName),
  fetchDbInfo(localCouchUrl, localAuthHeader, dbName),
])
```
