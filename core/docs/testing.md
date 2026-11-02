# Local CouchDB testing

Run from this layer. The sole required environment variable is `COUCHDB_ADMIN_AUTH`, inherited from the caller as base64-encoded `username:password`. Scripts never load dotenv files or display credentials. CouchDB must already run at `http://localhost:5984`; no Docker or Nuxt startup is involved.

Use `pnpm test:doctor` for a read-only connectivity, administrator identity and optional configuration check. Use `pnpm test:unit` for offline tests and `pnpm test:local` for the real local database suite. The local suite covers CRUD, conflict revisions, local documents, bulk writes, indexed views with bounded polling, binary attachments, database membership with native password/cookie sessions and logout, and isolated configuration writes. Timing thresholds report performance without failing tests.

The optional flat native section `cf_env_couchdb_tests` accepts these string or numeric values:

| Key | Default | Accepted |
| --- | --- | --- |
| test_http_timeout_ms | 3000 | integer 100–30000 |
| test_ready_timeout_ms | 5000 | integer 100–30000 |
| test_slow_threshold_ms | 1000 | integer 1–60000; report only |
| test_report_timings | true | true/false |
| test_keep_failed_resources | false | true/false |

An absent section (404) uses defaults. Authentication, access, transport and malformed setting errors fail immediately. No existing section is changed by the harness.

Each run writes a secret-free ownership manifest in `.test-runs/<runId>.json` before creating resources. Database and native user names start with a cryptographic `couchdb_test_<runId>` namespace; temporary configuration sections use `cf_env_couchdb_test_<runId>`. Cleanup accepts exact manifested resource IDs only, validates the manifest marker and namespace, checks user/config ownership markers, and deletes users by their current exact revision. It never deletes `_users`, edits existing design documents, or changes shared authentication configuration. Test views live inside owned databases.

Cleanup runs in `finally`, including failed tests. With `test_keep_failed_resources=true`, failed runs remain for inspection. After interruption or a crash, recover with `pnpm test:cleanup <exact-runId>` using the filename in `.test-runs`. There is no broad prefix scan or global reset. Failed cleanup keeps the manifest for retry. Do not remove manifests until resources are cleaned.

Same-instance replication uses two owned scratch databases and a synchronous one-shot replication request with a per-operation deadline of `max(15000, test_ready_timeout_ms)` milliseconds. Other HTTP requests retain `test_http_timeout_ms`; there is no persistent shared replication job.

## Manual smoke test in cf-cloud

For a quick check of the login UI and `/admin` against a dev server, run cf-cloud with `nuxt dev` (Node 22.21+ or 24.11+) and test with two local users: one with the `admin` role and one without. The 2026-10-28 run and its findings are in `apps/cf-cloud/implementation_results/2026-10-28-login-admin-testing.md`.
