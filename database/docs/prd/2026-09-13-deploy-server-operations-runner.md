# PRD: Deploy Server Operations Runner

Date: 2026-09-13  
Status: Proposed; implementation not started  
Owner: CouchFusion database layer  
Integration: Database → Data Sync (`/admin/datasync`) → **Deploy Server Operations**

## 1. Product outcome

An authenticated CouchFusion administrator can build the consuming application, follow build logs, validate its content component registry, inspect the generated deployment changes, and commit and push those artifacts from a dedicated `.output` Git checkout to its configured remote.

The workflow is operated from the existing database admin interface. Commands execute on the machine hosting an explicitly configured local runner, which may be the developer's machine or a dedicated build machine. A browser opened on another machine does not execute commands on that browser's machine.

A successful push means the remote Git branch contains the reviewed artifact commit. It does not mean a production service has restarted or a hosting deployment has succeeded.

## 2. Current integration context

Repository inspection establishes the following integration points:

- `pages/admin/datasync.vue` provides the Data Sync page, using `admin-auth` middleware and the consuming application's admin layout.
- `utils/register-layout.ts` registers the database admin navigation and resolves the host layout. The page also has a runtime layout fallback. Preserve both mechanisms.
- `server/api/datasync/*` provides authenticated CouchDB operations; handlers such as `replicate.post.ts` use `assertAdminSession` from the auth layer.
- `utils/couch-config.ts` provides app-specific configuration through flat keys in CouchDB `_config`, section `cf_env_<app-slug>`.
- Existing Data Sync functionality includes remote CouchDB connection settings, database comparison, replication and document synchronization.

These are integration precedents, not an instruction to reuse the existing remote CouchDB credentials for Git or runner access. Database synchronization and artifact publishing remain independent operations.

In the inspected Mindarchy workspace, `git -C .output rev-parse --show-toplevel` resolves to the app repository, not a dedicated `.output` repository. Setup must detect this condition and disable artifact Git mutations until a separate deployment checkout is configured. Never silently fall back to the source repository.

## 3. Scope

### MVP capabilities

1. Display runner availability, host identity, app identity and configured deployment target.
2. Validate component registry definitions against the consuming app's source components.
3. Run the configured Nuxt production build and stream stdout/stderr.
4. Preserve and expose job history, timestamps, exit status and reconnectable logs.
5. Inspect `.output` repository status, staged/unstaged changes, textual diffs and binary-file summaries.
6. Review a build's complete artifact changes, supply a commit message and create a local artifact commit.
7. Push the reviewed artifact commit to the configured remote and branch.
8. Show actionable failure states and cancel long-running validation/build jobs.

### Out of scope

- Arbitrary shell commands, interactive terminals or editable command text in the browser.
- Source-code commits, source pushes or automatic changes to source files.
- Repository creation, cloning, credential enrollment or changing remotes through the UI.
- Force pushes, automatic pulls, merges, rebases, branch creation, hard resets or rollback commands.
- Production process restart, remote command execution, SSH deployment orchestration or deployment webhooks.
- Scheduling, multiple parallel builds for one target, localization, or a general CI platform.
- Coupling a Git push with CouchDB replication or requiring a rebuild for ordinary database content edits.

## 4. User flow and page integration

Keep `/admin/datasync` as the navigation entry. Add two accessible tabs beneath the existing page heading:

- **Data Sync**: current connection, database and replication interface.
- **Deploy Server Operations**: runner interface.

Persist the selected tab in a query parameter, for example `?tab=deploy`. Existing URLs without the parameter open Data Sync. A build is not dependent on configuring a remote CouchDB host. Failure to reach the runner must not block database synchronization.

The deploy tab contains:

1. **Target summary**: app name, runner host, connection state, source revision/dirty state, artifact checkout, branch, sanitized remote and last successful build/push.
2. **Operations**: Validate Registry and Build. Build includes registry validation as its first gate. Disabled actions explain the specific unmet condition.
3. **Job view**: operation, phase, elapsed time, streaming log, cancel control and final result. Auto-follow can be paused; reconnect and log download preserve the reading position.
4. **Artifact changes**: refreshable file list with change type, selected file diff, file counts, binary summaries and additions/deletions where available. Large diffs are bounded and explicitly marked as truncated.
5. **Commit**: review the whole artifact change set, enter a required message, then commit. MVP stages the complete approved artifact manifest, including deletions, rather than offering partial artifact releases.
6. **Push**: show local commit(s), exact branch and sanitized remote before a separate explicit Push action. After completion, display the remote branch SHA verified by the runner.
7. **Recent jobs**: reopen logs and results after navigation or a dev-server restart.

All controls work with keyboard navigation. Job updates use a restrained live region; do not announce every log line. Render logs and diffs as escaped text, never executable HTML or terminal escape instructions.

## 5. Architecture

Use a standalone runner process, not child processes owned by a browser request or the Nuxt dev server. The database layer supplies the UI and same-origin API adapter. A small sibling CLI package, proposed as `cli-deploy-runner`, owns execution, locking, logs and durable job state. Final package naming is an implementation detail.

Request path:

`Admin browser → authenticated Nuxt API → local runner → fixed Nuxt/registry/Git commands`

The Nuxt adapter authenticates the admin session, checks the origin/CSRF protection for mutations and proxies only supported operations. The runner authenticates the adapter, resolves a registered app/target ID and executes predefined argument arrays without a shell.

The runner binds to a Unix socket or loopback interface by default. It is independently started and remains alive when Nuxt reloads or rebuilds. The browser never receives the runner credential or a direct runner endpoint. The runner does not start automatically merely because an app extends the database layer. A deployed public app has execution disabled by default.

The database layer must not import code from a consuming application. Host-specific paths and executable choices live in a trusted runner profile. Existing `assertAdminSession` authorization can be reused at the adapter boundary when the host supplies the auth layer; otherwise operations are unavailable rather than unprotected.

## 6. Build and `.output` repository contract

### Distinct roots

Each profile defines a source app root, an artifact Git checkout root (normally `<app>/.output`), and runner-owned staging/state directories outside both. The source app root may belong to a monorepo. Its relative shared-layer and registry-generator paths must resolve correctly.

Before every mutation, resolve real paths and verify that the artifact Git top level equals the configured artifact root. Support both a `.git` directory and a Git worktree `.git` file; preserve either form and verify its configured Git directory. Reject a checkout inherited from a parent repository, an unexpected branch, unresolved conflicts or an unexpected Git directory. Never run artifact commands against the source root.

### Build pipeline

1. Resolve the trusted profile and acquire a per-target mutation lock.
2. Verify tools, paths, free-space policy and artifact checkout identity. Refuse to replace existing uncommitted artifact changes or a staged index; offer inspection and an explicit commit of a prior runner-produced build instead.
3. Capture source revision, dirty state and a fingerprint of relevant app/shared-layer/config/lockfile inputs. Source changes need not be committed, but must be visible in build provenance.
4. Validate the registry without changing the source checkout.
5. Build into a unique staging output with isolated Nuxt build intermediates. The final `.output` checkout is never the direct build destination. Verify that the host profile's output override is honored; block profiles whose build can clean or overwrite the checkout.
6. Verify exit code and configured output contract, e.g. Nitro server entry and required public/runtime files for the selected preset. Compare the source fingerprint again. Mark a build with changed inputs as stale and do not promote it.
7. Produce an artifact manifest and content hash. Copy/synchronize the successful artifacts into the checkout using a journaled operation with rollback on failure. Remove obsolete generated files, while preserving `.git` and explicitly configured deployment-owned files. Never follow artifacts' symlinks outside permitted roots.
8. Record the resulting tree fingerprint and expose its Git diff for review. Promotion never commits or pushes automatically.

The artifact manifest must contain everything required to run the chosen output preset, including generated runtime dependencies where required. Do not blindly inherit ignore rules that omit required output files. The profile distinguishes generated artifact paths from protected deployment-owned files. Credentials, runner state, logs and source `.env` files must not enter the artifact manifest.

MVP must not promote into a directory used by a running production process. A consuming app that cannot direct its build into staging is reported as unsupported until its build profile is adapted.

## 7. Registry validation

Validate using the consuming app's existing registry generator and component conventions. Checks include:

- Source components are discoverable and definitions match current props/slots.
- IDs are unique; generated definitions are parseable and schema-compatible.
- Field types, structured array/object shapes, defaults and select metadata are valid.
- Inline editable prop paths are checked where a deterministic static validator is available; report dynamic paths that cannot be verified statically rather than claiming full coverage.
- Generated timestamps follow the generator's source-mtime convention; comparisons must avoid false staleness caused by wall-clock generation time.

Run generation in check mode or to temporary destinations and compare against the committed/current registry files. If the generator lacks non-mutating support, implementing that support is a prerequisite. Validation must not overwrite source definitions, create source commits or silently repair failures. Report stale definitions with the local regeneration command. Build and artifact commit are blocked until the registry gate passes.

## 8. Git operations

**Status and diff:** Read fresh checkout state, branch, local HEAD, index, remote tracking information, untracked files and textual/binary changes. Use structured/zero-delimited Git output so spaces and unusual filenames remain unambiguous. Offline status is permitted; mark remote information stale until refreshed.

**Commit:** Require a successful non-stale runner build, a valid registry result and a reviewed artifact fingerprint. Recheck HEAD, branch, index and tree under the mutation lock. A changed fingerprint invalidates the review. Stage only paths belonging to the approved manifest/protected-path policy, including deletions. Use a message file or argument array, not shell interpolation. An empty change set produces “No changes to commit.” Return the commit SHA and provenance. Leave a failed commit's exact staged state visible; do not silently reset it.

**Push:** Require a separately reviewed artifact commit and configured remote/branch. Refresh the remote ref first. Fast-forward-only push to that exact destination; no force option. If remote history diverges, stop and explain that manual reconciliation is required. Never publish unrelated pre-existing local commits unnoticed: display all commits that would be sent and block unreviewed/non-runner commits in MVP. Verify the destination SHA after push. If transport fails after transmission, report an indeterminate result and reconcile against the remote before retrying.

Git author identity, signing, hooks and SSH/HTTPS authentication use the runner host's preconfigured Git environment. Never prompt for credentials in logs or disable verification/signing to force success. Run non-interactively with a timeout. Missing credentials, signing interaction or a failing trusted repository hook yields a specific error.

## 9. Proposed API contract

All endpoints are app-scoped, admin-authenticated and served by the Nuxt adapter under `/api/deploy-operations`. Browser bodies accept target IDs and operation parameters, never paths or executable strings.

| Endpoint | Purpose |
| --- | --- |
| `GET /capabilities` | Enabled state, authorized target summaries, runner connectivity and supported actions |
| `GET /targets/:id/status` | Source/artifact identities, Git status, latest build and gate state |
| `GET /targets/:id/diff?path=…` | Bounded diff for a file in the current approved status snapshot |
| `POST /jobs` | Start `validate-registry`, `build`, `commit` or `push`; return job ID immediately |
| `GET /jobs` | Paginated job history for authorized targets |
| `GET /jobs/:id` | Job state, phase, provenance and result |
| `GET /jobs/:id/events` | SSE events with replay cursor and heartbeats |
| `GET /jobs/:id/log` | Download redacted logs |
| `POST /jobs/:id/cancel` | Request cancellation when the current phase allows it |

Mutations carry an idempotency key. Commit and push also carry the reviewed fingerprint/expected SHA. Duplicate requests return the same job, not a second command. Reject stale reviews with `409`, disabled/unavailable runner with a clear service-state response, and unauthorized access with `401/403`. Apply authorization to log/status reads as well as actions.

SSE events have monotonically increasing sequence numbers. Reconnect with the last sequence to replay without losing or duplicating displayed lines. Provide bounded polling as a fallback. Browser disconnect does not cancel a job.

## 10. State and configuration

Suggested job fields: ID, app/target ID, operation, actor ID, idempotency key, state, phase, creation/start/end times, exit code, signal, redacted error, source SHA/fingerprint/dirty flag, registry result, artifact manifest hash, base/result commit SHAs, remote/branch, last log sequence and reviewed fingerprint.

States: `queued`, `running`, `cancel_requested`, `succeeded`, `failed`, `cancelled`, `interrupted`, `indeterminate`. Phases distinguish preflight, validation, build, promotion, diff, staging, commit and push. After runner restart, reconcile incomplete jobs and locks; do not relaunch mutating commands automatically. Cancellation kills the validation/build process group. Commit, promotion and push are non-cancellable once their mutation phase begins; the UI explains this before starting them.

Store durable job metadata, logs and promotion journals in a runner-owned directory outside `.output`, with restrictive permissions, bounded disk use and configurable retention. Default retention proposal: 30 days, with a per-job log size cap and visible truncation status. Pruning must never remove files needed by an active job or unresolved promotion recovery.

Use flat app-scoped `_config` keys for applicable non-secret policy, such as `DEPLOY_OPERATIONS_ENABLED` and `DEPLOY_RUNNER_PROFILE_ID`. Trusted executable paths, argument lists, filesystem roots and runner credentials are installed locally, not editable through page documents or arbitrary `_config` values. Resolve the profile ID against a local allowlist. Keep secrets in protected host configuration; never expose them through public runtime config or browser local storage.

## 11. Operational constraints

- Only one filesystem/Git mutation job may run per artifact target, across all tabs and app instances using that target.
- Read-only status may remain available during a job but must identify transient state. Do not offer a committable diff during promotion.
- Every executed operation has actor, target, time and result attribution. Redact credentials from logs, URLs and error details; build scripts remain trusted local code.
- Restrict Git remote protocol/host and branch to the installed profile. Reject remote changes discovered after review.
- Build failure, stale source, validation failure or cancellation leaves the prior artifact checkout intact.
- Nuxt reload or admin navigation must not terminate the runner's active process.

## 12. Acceptance criteria

1. The deploy tab renders inside the same host admin layout as Data Sync; replication works unchanged with the runner disabled/offline.
2. Unauthorized requests cannot execute commands or retrieve logs; arbitrary commands, paths, targets and cross-origin mutation requests are rejected.
3. The inspected parent-repository `.output` case is rejected before any stage/commit/push action.
4. Validation detects an intentionally stale registry, makes no source edits and blocks Build/Commit; a current registry passes.
5. Build streams both output channels, shows phase/exit status and survives browser disconnect and Nuxt dev-server restart.
6. A failed or cancelled build leaves the artifact checkout and Git metadata unchanged. A successful build handles file additions, changes and deletions while retaining protected files and Git history.
7. Source edits during a build mark its output stale and prevent promotion.
8. Commit includes exactly the reviewed complete artifact change set. A changed HEAD/tree/index after review blocks the action.
9. Push sends only reviewed artifact commits to the displayed remote/branch, verifies the remote SHA and rejects divergence without force or automatic merge.
10. Duplicate requests do not duplicate builds, commits or pushes. Two simultaneous mutation requests cannot race on the same target.
11. Logs survive reconnect/restart with ordered replay, redact secrets and respect retention limits.
12. Git authentication/signing/hook failures are visible and non-interactive; uncertain push outcomes are reconciled before retry.
13. Browser verification covers keyboard operation, reconnect, failure states and history. Integration tests use temporary source/artifact repositories and a local bare remote; they never push to a real deployment remote.

## 13. Delivery sequence

1. **Runner foundation:** profile format, local transport authentication, job persistence, locking, fixed commands, streaming/replay and process lifecycle.
2. **Validation/build:** non-mutating registry check, staged Nuxt output, artifact manifest, checkout verification, promotion journal and failure tests.
3. **Git review/publish:** status/diff, fingerprint gates, commit, fast-forward push, remote reconciliation and temporary-repository tests.
4. **DataSync integration:** deploy tab, admin adapter, job/log UI, review flows and host-layout compatibility tests.
5. **Pilot and documentation:** configure one consuming app and disposable deployment remote, run end-to-end acceptance tests, document runner installation and recovery, then enable its intended remote explicitly.

Success is demonstrated by building a consuming app from the admin, reviewing the resulting `.output` diff, committing it and verifying the pushed SHA in a disposable remote, without changing source Git state or interrupting Data Sync.

## 14. Setup inputs to resolve during implementation

The PRD does not block on these host-specific values. Setup must collect and validate them before enabling mutation controls:

- Runner host and supported OS/runtime; Mindarchy can retain Bun as its script runner while Nuxt uses Vite/Nitro.
- Source root, isolated build/output profile and complete set of source fingerprint inputs.
- Dedicated artifact checkout, trusted Git directory, existing remote/branch and author/signing configuration.
- Protected deployment-owned files and output preset/runtime dependency requirements.
- Registry generator check-mode support, build limits and log retention policy.

## References

- [Database layer overview](../../README.md)
- [DataSync functional history](../datasync_functionality.md)
- [Host admin-layout compatibility](../implementation_results/2026-04-21T09-30-59Z_datasync-admin-layout-resolution-host-app-compatible.md)
- [CouchDB configuration reader](../2026-03-08T15-16-42Z_couchdb-config-env-reader.md)
