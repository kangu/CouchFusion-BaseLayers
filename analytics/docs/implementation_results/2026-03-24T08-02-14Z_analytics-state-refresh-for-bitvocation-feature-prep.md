# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved , review the past work from /docs folders and prepare to implement work on features.

# Plan
1. Re-check analytics layer runtime contract and source files.
2. Review latest analytics implementation logs and compare against current code.
3. Validate integration expectations from selected consuming app (`apps/bitvocation`).
4. Produce a readiness refresh with concrete pre-feature hardening tasks.

# Implementation Summary
- Re-validated `layers/analytics/nuxt.config.ts`, client/server plugins, composable, and `server/api/stats.post.ts`.
- Confirmed CouchDB `_config` fallback is implemented and active in runtime resolution flow.
- Confirmed no analytics tests currently exist in this layer.
- Confirmed one plugin (`plugins/component-analytics.client.ts`) remains unregistered/dormant.
- Confirmed documentation still has drift (README still mentions script auto-load behavior not represented by current plugin path).

## Current readiness
- Operationally usable for current event forwarding.
- Not yet hardened for broader feature expansion due to docs drift + missing tests + dormant plugin ambiguity.

# Next Steps
1. Update README to match real architecture (`/api/stats` event forwarding + current directive/composable behavior).
2. Decide and implement one direction for `component-analytics.client.ts`:
- register + document, or remove.
3. Add tests for `server/api/stats.post.ts`:
- websiteId resolution precedence,
- excluded path handling,
- upstream non-OK behavior mapping.
