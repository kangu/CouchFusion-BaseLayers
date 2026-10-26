# Provisioning/configuration safety fixes

Branch: feat/merged-couchdb. Date: 2026-10-26.

## Provisioning

- createDatabase now distinguishes newly created (true) from already existing (false/HTTP 412).
- initializeDatabase assigns the supplied security only when that invocation creates the database. Existing policy is preserved, including when a concurrent creator wins. Deliberate existing-policy updates remain a separate setDatabaseSecurity call.
- Design-document upsert compares normalized content with sorted object keys and ignores CouchDB response metadata. Unchanged documents retain revision/update_seq; meaningful changes use the current revision.
- CLI and initialization share structural validation before any request. Malformed database/security/design structures, duplicate normalized design IDs, and unsupported policy fields are rejected. Policy JSON cannot silently override the local endpoint or embed adminAuth.
- Server compilation/permission/transport failures can still leave partially provisioned new databases. No automatic deletion or security overwrite occurs during retry; deliberate recovery is documented.

## Configuration

- Local defaults and effective merged settings share schema validation for types, ranges, enums, roles, URLs/navigation and application store names. Invalid JavaScript option groups/boolean strings and malformed known remote values fail clearly.
- Active email requires token storage and signing secret; Nostr requires challenge storage and signing secret; PoW requires challenge storage. Remote-disabled methods do not require inactive stores/secrets. Disabling every login method also disables dependent UI/PoW capabilities.
- An optional unavailable section may fall back to validated defaults; malformed present JSON/sections are rejected. Configuration error messages name fields without echoing values.
- Runtime snapshots are cloned and recursively frozen, including nested roles/navigation/feature flags/secrets. Caller defaults are not frozen or shared. Public projection is a detached allowlisted copy.

## Verification

Regression tests were written/run RED before fixes. Final commands on supported Node 24.22.1:

- pnpm test: 98 tests / 18 files passed; observed total 878ms.
- pnpm typecheck: passed.
- pnpm test:local: 3 suites passed, including exported provisioning operations against owned scratch databases. Existing policy, unchanged revisions/update_seq and fresh-database policy were checked. Temporary resources cleaned; no manifest JSON remains.
- pnpm test:nuxt: 4 password/admin/SSR regression tests passed, including isolated build.
- pnpm test:matrix: database-only, password/admin/Data Sync and optional-provider builds passed without credentials; forbidden browser import of server utilities was correctly rejected.
- git diff --check: passed.

An independent review identified the structural-validation-before-allocation gap; the follow-up reproducer and CLI subprocess tests now pass. No application config section, shared _users design document, native CouchDB policy, other app, or legacy layer was changed.

This closes provisioning/configuration safety findings from the gap review. It does not implement selected-feature auth-design provisioning, remote feature-aware preflight, legacy email adapters, prefix-aware login, live-client wiring or admin parity; those remain separate work.
