# Initial Prompt
We are working on extending the analytics layer. I am changing the workflow to pass through a server-side /api/stats. I get the error 500 "Cannot read properties of undefined (reading 'getSSRProps')" on the v-analytics directive while testing in the couchfusioncom app. How can I fix that?

# Implementation Summary
Manual implementation; no automated code generator output was produced.

# Documentation Overview
- Registered the analytics directive under a single `v-analytics` name to match the new API and avoid conflicting aliases.
- Added a dedicated server plugin so Nuxt's SSR renderer always knows about the directive and no longer throws `getSSRProps` errors.
- Ensured the analytics tracker is exposed via both `$analytics` and `$umami` for backwards compatibility while auto-imports continue using `useAnalytics`.
- Updated README and reference docs to describe the new directive, refreshed examples, and migrated sample usage in dependent apps.

# Implementation Examples
- `layers/analytics/plugins/analytics.client.ts` now provides `$analytics`/`$umami` and registers `v-analytics` with the renamed cleanup helpers.
- `layers/analytics/plugins/analytics.server.ts` introduces the SSR-safe directive shim returning empty props.
- `layers/analytics/README.md` documents the `useAnalytics` composable plus new directive syntax, while `apps/radustanciu/app/pages/testing.vue` demonstrates `v-analytics` in use.
