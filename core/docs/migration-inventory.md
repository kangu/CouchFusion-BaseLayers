# Database extraction inventory

Canonical operations live at `#core/server/operations`. They take an explicit service or session client as their first argument. `utils/couchdb` re-exports these new signatures; it intentionally does not emulate the old credential-bearing signatures. No dependency on the auth layer remains in database operations.

Extracted: document CRUD, `_local` CRUD, inline attachments, binary attachment read/write/delete, bulk docs, views, all-docs, database creation/info/security, design-document upsert, deliberate initialization and connection probing. Authentication/session/cookie cryptography belongs to the new auth server module and is not re-exported here. Missing documents return null; denied access, conflict and transport errors propagate. View options use query parameters; `keys` uses the POST body.

The `_config` reader retains parsing and section-name helpers, with an explicit client argument for reads/writes. It no longer reads `COUCHDB_URL` or obtains implicit administrator credentials.

Seven Data Sync routes retain their relative filenames under `src/features/datasync/server`, registered under `/api/couchdb/admin/datasync`. All check administrator access and the dataSync feature flag. POST routes enforce the cookie mutation guard. Local requests target localhost:5984; bootstrap authentication comes only from the central client bootstrap. The optional page uses admin-workspace, the global route guard, and temporary in-memory connection fields; password is cleared on unmount.

Provisioning is explicit and dry-run by default: run `scripts/provision.ts --config /absolute/config.json`, review output, then add `--apply`. The config must supply `url`, `adminAuth` (base64 username:password), a non-system `database`, and an explicit `security` object; optional `designs` contains design documents. No startup plugin provisions databases. Neither CLI edits `_users` or shared configuration. `scripts/preflight.ts --config ...` only reads the explicitly named database and reports its status. Use a disposable scratch target for integration verification.

Legacy consumers should migrate calls to explicit clients. No migration of old shared database security policies is automatic.

Optional live users uses a worker-local longpoll `_users/_changes` follower. Nitro close aborts the follower and clears subscriptions. The SSE route requires a verified user and enabled feature; each connection receives only its own `{name, roles}` updates. Password hashes, arbitrary user-document fields, and other users' events never enter the stream. Disabled workers do not start a follower.

Verification: operations and live-user isolation/lifecycle unit tests pass (9 tests). The owned same-instance replication integration test uses the manifest-based scratch database helper and finally cleanup. It requires explicit local test administrator credentials; the unconfigured invocation failed before allocation.
