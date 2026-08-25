# Analytics Couch Website ID PR Review

## Scope

- Reviewed `github/feat/analytics-couch-website-id` at commit `d036152ab92639b2f6581c61a2f7c9b038c1dee8` against `github/main` at `58fcf56f602d47044c41d13885e5296dfad8c6fc`.
- The branch is one commit ahead and changes:
  - `analytics/nuxt.config.ts`
  - `analytics/server/api/stats.post.ts`
  - `analytics/server/plugins/init.ts`
  - `analytics/server/utils/umami-config.ts`
- Reviewed the shared database `_config` helpers and all eleven current app consumers.

## Recommendation

Do not merge the PR unchanged. The direction is sound—runtime CouchDB `_config` avoids build-time website-ID drift—but the current patch introduces compatibility, privacy, and operational regressions for other consumers.

## Review Findings

### P1: CouchDB excluded paths are silently dropped

`stats.post.ts` previously resolved exclusions from either private runtime config or CouchDB `_config`. The PR replaces this with private runtime config only:

```ts
const excludedPaths = normalizeExcludedPaths(
  runtimeConfig.analytics?.umami?.excludedPaths,
)
```

Any deployment relying on CouchDB `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` loses its exclusions after upgrading. This is especially risky because automatic tracking includes full dynamic routes, query parameters, and fragments, including tokenized login routes.

Required fix before merge:

- Extend the new resolver to return excluded paths as well as website ID.
- Prefer a normalized lower-case key such as `umami_excluded_paths`, with a documented temporary fallback to the legacy key if needed.
- Add regression tests for exact, prefix/glob, query, hash, and nested auth-route exclusions.

### P1: The endpoint is not actually CouchDB-only

When CouchDB resolution returns an empty website ID, `stats.post.ts` preserves `payload.website`. Browser consumers with public website-ID config therefore keep working and can mask the missing CouchDB migration:

```ts
const normalizedPayload = websiteId.length > 0
  ? { ...payload, website: websiteId }
  : { ...payload }
```

This contradicts the PR's stated CouchDB-only contract. It also permits callers to select an arbitrary Umami destination whenever CouchDB is missing.

Choose one explicit rollout policy:

1. Strict cutover: reject when CouchDB `umami_website_id` is missing and always overwrite the client field.
2. Staged cutover: introduce a clearly logged, time-bounded legacy fallback, test it, and remove it in a second release.

Do not retain the current accidental fallback.

### P1: Missing configuration creates a CouchDB request per analytics event

Only successfully resolved values are cached. For every non-migrated app, every public `/api/stats` request causes another CouchDB `_config` read. The startup plugin logs the missing state but does not stop the server, and browser-provided IDs can keep traffic flowing indefinitely.

Required fix:

- Cache missing/error results for a short TTL or use exponential backoff.
- Add single-flight behavior so simultaneous first events do not duplicate CouchDB reads.
- Expose a health/readiness signal or metric for missing configuration.

### P1: Eight consumers have no explicit app slug

The new resolver uses `runtimeConfig.public.appSlug`, then falls back to `basename(process.cwd())`. The PR itself explains why CWD-based resolution previously selected the wrong section, but eight consumers still rely on that same fallback.

Explicit slugs already present:

- `bitvocation` -> `cf_env_bitvocation`
- `couchfusioncom` -> `cf_env_cfcom`
- `lovable-gifts-sdd` -> `cf_env_lovable-gifts`

Explicit slugs missing:

- `forest-cabin`
- `kangu`
- `kids-store`
- `lovable-test`
- `nuxt-app-starter`
- `radustanciu`
- `smart-lead`
- `testing-1`

The PR should document `public.appSlug` as required for deterministic production resolution. Prefer failing or disabling analytics when it is absent instead of silently selecting the deployment working-directory name.

### P2: The intentionally inert fixture becomes noisy

`lovable-test` overrides `/api/stats` with an inert handler, but the new Analytics startup plugin is still auto-discovered and will log an initialization failure without a Couch website ID. The layer needs an explicit `analytics.enabled: false` contract that skips startup validation and event forwarding.

### P2: No direct tests or migration documentation

The PR adds a test reset seam but no tests. Missing coverage includes:

- section selection from `public.appSlug`
- `umami_website_id` parsing
- missing-value behavior
- cache and retry behavior
- concurrent resolution
- startup source logs
- strict rejection versus fallback behavior
- exclusion preservation
- app-disabled behavior

README and `analytics/agents.md` still document the old environment keys and removed `couchEnvSlug` option.

## Consumer Impact Matrix

| App | Current ID source | Explicit slug | Effect if upgraded unchanged | Required migration |
|---|---|---:|---|---|
| bitvocation | private `UMAMI_WEBSITE_ID` | `bitvocation` | Hard failure for server events and browser events unless Couch key exists | Pre-provision `cf_env_bitvocation/umami_website_id` |
| couchfusioncom | private `UMAMI_WEBSITE_ID` | `cfcom` | Hard failure unless Couch key exists | Pre-provision `cf_env_cfcom/umami_website_id` |
| forest-cabin | public payload ID | missing | Browser events continue accidentally; startup error and Couch read per event | Add slug `forest-cabin`; provision key |
| kangu | public payload ID | missing | Same accidental fallback/per-event read | Add slug `kangu`; provision key |
| kids-store | public payload ID | missing | Same accidental fallback/per-event read | Add slug `kids-store`; provision key |
| lovable-gifts-sdd | public payload ID | `lovable-gifts` | Browser events continue accidentally; per-event Couch read | Provision `cf_env_lovable-gifts/umami_website_id` |
| lovable-test | inert app route | missing | App remains inert but logs startup failure | Add disable flag; do not provision a fake production ID |
| nuxt-app-starter | public payload ID | missing | Same accidental fallback/per-event read; clones inherit ambiguity | Add configurable slug; document key provisioning for generated apps |
| radustanciu | public payload ID | missing | Same accidental fallback/per-event read | Add slug `radustanciu`; provision key |
| smart-lead | public payload ID | missing | Same accidental fallback/per-event read | Add slug `smart-lead`; provision key |
| testing-1 | public payload ID | missing | Same accidental fallback/per-event read | Add slug `testing-1`; provision key |

Bitvocation also has a server-side `/api/stats` producer in `server/routes/redir.get.ts`; its payload does not contain `website`, so it strictly depends on successful Couch resolution after this PR.

## Safe Migration Path

### Phase 0: Fix the PR

1. Preserve and normalize excluded-path resolution.
2. Decide and implement strict versus staged ID fallback explicitly.
3. Add missing-config TTL/backoff and single-flight caching.
4. Add `analytics.enabled` and skip startup work when disabled.
5. Add direct tests and update README/agent instructions.

### Phase 1: Prepare apps without changing the shared layer

Add deterministic runtime slugs:

```ts
runtimeConfig: {
  public: {
    appSlug: "forest-cabin",
  },
}
```

For starter/template projects, make the slug deployment-configurable and require generated apps to override the starter default.

Keep existing website-ID environment configuration during this phase so rollback remains safe.

### Phase 2: Pre-provision CouchDB

For each real analytics-enabled deployment, create the flat lower-case key before deploying the new layer:

```text
[cf_env_<app-slug>]
umami_website_id = <existing Umami website ID>
```

Ensure runtime `COUCHDB_URL` and `COUCHDB_ADMIN_AUTH` are available to the Nitro process. Do not put the admin credential or website ID in committed files.

If exclusions are moved into the same contract, also provision:

```text
umami_excluded_paths = /login/*,/admin/*,/auth/*
```

Use the exact sensitive routes for each app and include dynamic token routes.

### Phase 3: Canary the layer upgrade

Deploy one low-risk app first, then verify:

- startup logs show the expected `cf_env_<slug>` section
- `websiteId` source is `present from CouchDB key umami_website_id`
- one browser navigation and one custom event return 200 from `/api/stats`
- the event appears in the intended Umami property
- excluded routes do not reach Umami
- CouchDB request volume remains flat after first resolution

Then deploy Bitvocation separately and verify its server-side redirect event.

### Phase 4: Roll out remaining apps

Upgrade apps in small batches. Treat `lovable-test` and template projects separately using the disabled/configurable contract rather than fake IDs.

### Phase 5: Remove legacy configuration

Only after all deployments have passed runtime verification:

- remove `runtimeConfig.analytics.umami.websiteId`
- remove public `runtimeConfig.public.analytics.umami.websiteId` if strict Couch-only mode is selected
- retire `UMAMI_WEBSITE_ID` and `NUXT_PUBLIC_UMAMI_WEBSITE_ID`
- remove legacy `couchEnvSlug`
- keep rollback notes for one release cycle

## Verification Evidence

- Remote refs were freshly fetched from GitHub.
- Branch is one commit ahead of `github/main` and changes four Analytics files.
- `git diff --check` passed.
- Shared database slug tests passed: 3/3.
- The PR contains no Analytics-specific tests.
- All eleven consuming app configs and direct `/api/stats` producers were inspected.
