# Explicit provisioning

Core does not provision databases, design documents, users, or server policy on startup. Provisioning requires an explicit operation or CLI invocation using the inherited `COUCHDB_ADMIN_AUTH`; credentials do not belong in policy JSON.

```sh
pnpm provision --config /absolute/path/policy.json
pnpm provision --config /absolute/path/policy.json --apply
```

The first command previews the non-system database, supplied security policy, and design IDs without making requests. `--apply` creates a missing database, applies the supplied security policy only if that invocation created the database, and creates or updates the supplied design documents. Existing database security is preserved, even when the supplied policy differs. A concurrent creator that wins database creation also retains its security policy.

Policy JSON contains `database`, an explicit `security` object with `admins` and `members`, and optional `designs`. Design documents include `_id`, `language`, and `views` plus any other intended design fields. Provisioning compares all design content with sorted object keys, normalizes the `_design/` ID prefix, and ignores CouchDB response metadata (`_rev`, `_revisions`, `_revs_info`, `_conflicts`, `_deleted_conflicts`, `_local_seq`). Identical designs retain their revisions and database update sequence. Meaningful changes, including map/reduce source, validation functions, options, or removed fields, write a new revision using the current revision. Missing documents are created; denied requests and write conflicts remain errors.

Server code can import `createDatabase`, `initializeDatabase`, and `createOrUpdateDesignDocument` from `#core/server/operations` with an explicit client. `createDatabase` returns `true` when created and `false` when CouchDB reports an existing database (HTTP 412). An unchanged design returns `{ ok: true, id, rev }` with its current revision and performs no write.

To deliberately change an existing database's access policy, separately call `setDatabaseSecurity(client, database, security)` after reviewing the target and intended policy. `initializeDatabase` and CLI `--apply` do not perform that policy replacement. Shared `_users` design documents and native server authentication policy must not be automatically provisioned.

The CLI and `initializeDatabase` share pure structural validation before any request or allocation: database name, security names/roles string arrays, and basic unique normalized design IDs, language, views, and map/reduce shapes are checked. Query-language map objects are accepted alongside function strings. Only `database`, `security`, and `designs` are accepted at the policy top level; fields such as `url` or `adminAuth` are errors. The CLI always uses the local seed and inherited credential described above.

Structural validation does not compile design functions or predict CouchDB permissions. Server compilation, permission, or later transport errors can still leave a newly created database with some operations completed. No automatic deletion occurs. Inspect partial resources deliberately; retrying preserves their existing security policy and only writes changed designs. Change existing policy separately through `setDatabaseSecurity` when intended.
