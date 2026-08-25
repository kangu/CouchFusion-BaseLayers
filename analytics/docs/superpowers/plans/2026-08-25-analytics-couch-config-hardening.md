# Analytics Couch Config Hardening Implementation Plan

> **Execution note:** Implement this plan on `feat/analytics-couch-website-id` with the executing-plans and test-driven-development workflows.

**Goal:** Make CouchDB `_config` authoritative and resilient for the Analytics layer, restore excluded-path behavior, and give every consuming app a deterministic Couch environment slug.

**Architecture:** The Analytics server resolver reads the flat `cf_env_[appSlug]` CouchDB section, normalizes the website ID and exclusions, and caches both ready and temporarily missing results. The proxy rejects events when the required website ID is absent, overwrites any client-supplied website ID, and filters using the resolved Couch exclusions. Consumer apps explicitly set `runtimeConfig.public.appSlug` so section selection never depends on a process working directory.

**Tech stack:** Nuxt 4, Nitro/H3, TypeScript, Vitest, CouchDB `_config`.

---

## Task 1: Lock the resolver contract with failing tests

**Files:**

- Create: `analytics/server/utils/umami-config.spec.ts`
- Test: `analytics/server/utils/umami-config.spec.ts`

1. Mock `#database/utils/couch-config` and exercise the real Analytics resolver.
2. Add a test that `public.appSlug: "forest-cabin"` selects `cf_env_forest-cabin` and reads `umami_website_id`, `umami_excluded_paths`, and the legacy exclusion key.
3. Add a test that canonical `umami_excluded_paths` wins and is normalized from CSV.
4. Add a compatibility test for legacy `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS`.
5. Add a strictness test proving missing `umami_website_id` rejects instead of allowing a client fallback.
6. Add fake-timer tests proving missing config is cached for 30 seconds, then retried.
7. Add a deferred-promise test proving concurrent requests share one CouchDB read.
8. Run:

   `./node_modules/.bin/vitest --config vitest.config.ts analytics/server/utils/umami-config.spec.ts --run`

   Expected: FAIL because exclusions, negative caching, single-flight, and strict rejection are not implemented.

## Task 2: Implement the resolver and make the proxy authoritative

**Files:**

- Modify: `analytics/server/utils/umami-config.ts`
- Modify: `analytics/server/api/stats.post.ts`
- Modify: `analytics/server/plugins/init.ts` only if its call contract requires adjustment
- Test: `analytics/server/utils/umami-config.spec.ts`

1. Extend `UmamiConfig` with `excludedPaths: string[]`.
2. Read canonical `umami_excluded_paths`, falling back only to `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` for migration compatibility.
3. Record redacted source metadata and include exclusions in startup source notices.
4. Cache successful resolution for the process lifetime.
5. Cache a missing required ID for 30 seconds and use one in-flight promise for concurrent reads.
6. Make `resolveUmamiConfig` assert readiness before returning, so missing Couch config cannot fall through to client input.
7. In `/api/stats`, use the resolved Couch exclusions and always set `payload.website` to the Couch website ID.
8. Run the focused test until it passes.

## Task 3: Add deterministic slugs to all consumers

**Files:**

- Modify: `apps/forest-cabin/nuxt.config.ts`
- Modify: `apps/kangu/nuxt.config.ts`
- Modify: `apps/kids-store/nuxt.config.ts`
- Modify: `apps/lovable-test/nuxt.config.ts`
- Modify: `apps/nuxt-app-starter/nuxt.config.ts`
- Modify: `apps/radustanciu/nuxt.config.ts`
- Modify: `apps/smart-lead/nuxt.config.ts`
- Modify: `apps/testing-1/nuxt.config.ts`

1. Add explicit `runtimeConfig.public.appSlug` values matching each app folder.
2. For `nuxt-app-starter`, use `process.env.NUXT_PUBLIC_APP_SLUG ?? "nuxt-app-starter"` so generated apps can deliberately override the template identity while remaining deterministic by default.
3. Preserve the pre-existing edits in `lovable-test/nuxt.config.ts` and the untracked state/content of `testing-1/nuxt.config.ts`.
4. Verify all Analytics consumers expose a non-empty slug by inspecting their Nuxt configs.

## Task 4: Document the migration and implementation

**Files:**

- Modify: `analytics/README.md`
- Modify: `analytics/agents.md`
- Create: `analytics/docs/implementation_results/2026-08-25-analytics-couch-config-hardening.md`
- Create: an implementation result in each modified app's `docs/implementation_results/`

1. Document required `runtimeConfig.public.appSlug` and the authoritative section `cf_env_[appSlug]`.
2. Document required `umami_website_id` and optional `umami_excluded_paths` flat CouchDB keys.
3. Document the legacy exclusion-key compatibility window and removal path.
4. Explain that browser website IDs are no longer accepted by the proxy as a fallback.
5. Record initial prompt, plan, implementation summary, and next steps in the layer and each touched app.

## Task 5: Verify the complete change set

**Files:**

- Test: `analytics/server/utils/umami-config.spec.ts`
- Test: `database/utils/couch-config.spec.ts`

1. Run focused Analytics resolver tests.
2. Run the shared database slug/config tests.
3. Run the existing Analytics-related consumer tests available in the layer repository.
4. Inspect nested-repository diffs so only intended files changed and all pre-existing app edits remain intact.
5. Do not run app lint or final app builds, per the app-specific instructions.
