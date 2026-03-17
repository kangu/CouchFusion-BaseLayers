# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved, review the past work from /docs folders and prepare to implement work on features.

# Scope
- Target selected by user: `layers/analytics`.
- Reviewed:
  - Layer source code (`composables`, `plugins`, `server`, `types`, `nuxt.config.ts`, `README.md`).
  - Layer docs and implementation history under `layers/analytics/docs/**`.
  - Root implementation docs related to analytics under `docs/implementation_results/2025-11-07T*.md`.
  - Current analytics layer adoption across apps via `apps/*/nuxt.config.ts`.

# Current State Summary
- The analytics layer currently works as a first-party event sender to `/api/stats`, with Nuxt plugin injection and `v-analytics` directive support.
- The server endpoint forwards all requests upstream as Umami `event` payloads to `${runtimeConfig.analytics.umami.proxyHost}/api/send`.
- Historical docs show multiple prior implementations using `plugins/umami.client.ts`, `/script.js`, `/api/send`, and `/api/umami-script`, but those files/routes are no longer present in the current layer code.

# Key Findings
1. **Config mismatch can break analytics in multiple consuming apps**  
   - Server requires private `runtimeConfig.analytics.umami.websiteId` and overwrites incoming payload website with it.  
   - Several apps configure `websiteId` only under `runtimeConfig.public.analytics.umami.websiteId`, so server-side forwarding can fail with `Analytics websiteId missing`.

2. **Documentation drift is significant**  
   - README still claims script auto-loading and excluded-path manual tracking behavior that depend on older `umami.client.ts` architecture.
   - Multiple docs reference removed files/routes (`plugins/umami.client.ts`, `server/middleware/umami-proxy.ts`, `/api/umami-script`), which increases implementation risk.

3. **Unused plugin exists in layer**  
   - `plugins/component-analytics.client.ts` is present but not registered in `nuxt.config.ts`.
   - No codebase references to its `data-analytics-track` flow were found, so the behavior is effectively dormant.

4. **No analytics-specific automated tests currently in layers test workspace**  
   - No existing test files target analytics client/directive/server handler behavior.
   - Feature work currently depends on manual validation unless tests are introduced.

# Readiness Plan Before New Features
1. Normalize analytics config contract:
   - Decide authoritative source for `websiteId` and exclusions (private, public, or fallback chain).
   - Make server tolerant if only public config is present.
2. Reconcile docs with current implementation:
   - Update README to describe actual `/api/stats` flow.
   - Mark legacy docs as archived/obsolete where they reference removed files.
3. Decide status of component visibility tracking:
   - Either register `component-analytics.client.ts` and document it, or remove it to reduce dead surface.
4. Add minimal regression tests:
   - Server handler: payload validation, exclusion matching, website ID resolution.
   - Client composable: endpoint resolution and payload shaping.

# Next Steps
- Use this report as the baseline for the next implementation task and execute the readiness fixes in the order above before adding new analytics features.
