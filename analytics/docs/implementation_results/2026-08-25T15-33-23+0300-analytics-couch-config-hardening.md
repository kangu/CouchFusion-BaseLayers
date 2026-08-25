# Analytics Couch Config Hardening

## Initial Prompt

Handle review points 1, 2, 3, and 4 for `github/feat/analytics-couch-website-id`, supplying a deterministic `appSlug`, and proceed directly on the branch.

## Plan

1. Add failing tests for CouchDB exclusions, strict website authority, negative caching, and concurrent request deduplication.
2. Implement canonical and legacy exclusion resolution, fail-closed website handling, a 30-second missing-config cache, and single-flight reads.
3. Add explicit slugs to every Analytics consumer that lacked one.
4. Document the upgrade path and verify focused and regression tests.

## Implementation Summary

- Added `umami_excluded_paths` to the flat `cf_env_[appSlug]` CouchDB contract, with `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` retained as a migration fallback.
- Made `umami_website_id` strictly CouchDB-authoritative. `/api/stats` now fails when it is missing and always overwrites client-supplied website IDs.
- Added lifetime caching for ready config, a 30-second negative cache for missing required config, and one shared in-flight read for concurrent requests.
- Added redacted exclusion-source startup reporting.
- Added focused resolver and proxy tests covering all of the above behavior.
- Added deterministic `runtimeConfig.public.appSlug` values to the eight consumers that lacked one; the starter defaults to `nuxt-app-starter` and supports an explicit `NUXT_PUBLIC_APP_SLUG` override.
- Updated the Analytics README and layer guidance with a staged migration path.

## Verification

- `vitest analytics/server/utils/umami-config.spec.ts analytics/server/api/stats.post.spec.ts`: 7 tests passed.
- Full final verification is recorded in the task handoff after documentation and diff checks.

## Next Steps

1. Provision `cf_env_[appSlug].umami_website_id` for every deployment before rolling out the upgraded layer.
2. Move each app's exclusions to `umami_excluded_paths`; retain the uppercase legacy key only during the transition.
3. Monitor the redacted startup notices during rollout, then remove obsolete public website-ID environment values after all server instances are upgraded.
