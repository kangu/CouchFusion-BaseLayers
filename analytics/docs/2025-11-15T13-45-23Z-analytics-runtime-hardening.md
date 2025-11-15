# Initial Prompt
Analyse the analytics layer and propose relevant improvements to it, then implement all of the proposed fixes.

# Implementation Summary
Manual implementation; no automated code generator output was produced.

# Documentation Overview
- Reworked `useAnalytics` so every consumer gets a scoped client instance that stores its own configuration, exposes compatibility helpers (`track`, `trackView`, `isLoaded`), and posts events/pageviews through a shared `/api/stats` endpoint derived from runtime config.
- Updated the analytics client plugin to hydrate the tracker with `runtimeConfig.public.analytics` (endpoint, app name, flags) and provide both `$analytics` and `$umami` so legacy composables keep working.
- Hardened `/api/stats` server logic by validating body shape, ensuring `websiteId` is present, differentiating `event` vs `pageview`, and checking excluded paths against either `pathname` or `url`.
- Documented the new configuration knobs in the README and recorded this change log for the analytics layer.

# Implementation Examples
- `layers/analytics/composables/useAnalytics.ts` now exports `createAnalyticsClient`, scopes config per instance, and distinguishes `event` vs `pageview` payloads (lines 1-173).
- `layers/analytics/plugins/analytics.client.ts` pulls public runtime config, feeds it into the analytics client, and exposes `$analytics`/`$umami` while registering the `v-analytics` directive (lines 1-109).
- `layers/analytics/server/api/stats.post.ts` validates incoming requests, applies the configured `websiteId`, and respects excluded paths even when only a `pathname` is supplied (lines 1-120).
- `layers/analytics/README.md` highlights the configurable endpoint/metas and the expanded composable API (lines 60-105).
