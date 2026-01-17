## Initial Prompt
The /datasync/remote-dbs should filter the results returned by _all_docs to start with the dbLoginPrefix value, and then additionally also include "_users", but exclude everything else

## Implementation Summary
Implementation Summary: Filtered Data Sync database listings to include only names starting with dbLoginPrefix plus _users, preventing unrelated databases from appearing in the admin UI.

## Documentation Overview
- The remote-dbs endpoint now reads `runtimeConfig.dbLoginPrefix` and filters the `_all_dbs` response accordingly, always retaining `_users`.

## Implementation Examples
```ts
const filtered = payload.filter((name) => name === '_users' || name.startsWith(dbLoginPrefix))
```
