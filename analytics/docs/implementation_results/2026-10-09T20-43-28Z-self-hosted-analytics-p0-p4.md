# Self-hosted analytics engine: P0–P4 implementation

## Initial prompt
"proceed to start with each phase one after another until complete": implement the approved spec (`docs/specs/2026-10-09T19-47-30Z-self-hosted-analytics-spec.md`), pilot on `apps/kangu`.

## Plan followed
- **P0:** mode pipeline behind `/api/stats` (`umami_cloud` default, `dual`, `self_hosted`); CouchDB provisioning (admin-only security); collector with bot/DNT/IP rules, UA/referrer/channel/UTM/CDN-geo enrichment, daily salted visitor hash, batched writes to month shards.
- **P1:** visit/rollup engine, lease-guarded in-app aggregator, query layer (ranges, KPIs, series, top-N, realtime), access control, admin module (Overview, Realtime, Websites).
- **P2:** all dimensions, filters (raw scan), compare, CSV export, standalone `/a.js` tracker (Umami-compatible), CORS, share links, reset/rebuild, retention job, app-settings UI (IP exclusion etc.), outbound/download auto-capture, Events page.
- **P3:** goals, funnel, journeys, retention, UTM, attribution, revenue, breakdown reports; sessions explorer; `identify()` and opt-in persistent id; saved segments and saved reports.
- **P4:** API keys + `/api/analytics/v1`, viewer roles per site, Umami/Fathom import, tracking pixels, tracked short links, rollout guide.

## Summary
- Layer code: `server/engine/*`, `server/api/analytics/**`, `server/routes/{a.js,l/[slug]}.ts`, `server/plugins/{init,aggregator}.ts`, `modules/admin.ts`, `admin/**`. Client additions are in `composables/useAnalytics.ts` and `plugins/analytics.client.ts`.
- Tests: 35 unit tests (`server/engine/p0`–`p4.spec.ts`, existing `stats.post.spec.ts` kept green with a config mock) plus an opt-in CouchDB integration test. All pass.
- Verified against the running kangu dev server:
  - ingestion (JSON + text/plain), admin API, rollups, filters, realtime
  - all 8 reports, sessions, segments
  - share page in the browser (rendering + click-to-filter), standalone `/a.js`
  - API keys / v1, pixel, link redirect, imports (including duplicate-skip on re-import)
- Fixed during QA:
  - missing boolean prop defaults
  - BigInt literals rejected by esbuild's es2019 target
  - side-effect route registration dropped by Nitro's bundler
  - stale aggregator lease after restarts (now released on close)
- Deviations are listed in spec §8.
- Not verified: the authenticated admin pages in a real browser. They were server-rendered via curl with a session; browser login was not available to the agent.

## Next steps
- Run kangu in `dual` for 14 days of real traffic, compare with Umami Cloud, then switch to `self_hosted` (spec §6 P2 gate).
- Click through the authenticated admin pages in a browser.
- Roll out to other apps per `docs/self-hosted-analytics.md`.
- Content layer: runtime `ignore` list is overwritten in apps that also use `@nuxt/content` (separate task suggested).
