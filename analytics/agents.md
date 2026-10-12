# Layer: analytics

Runtime: nuxt 4.x, vue 3.5.x

Reusable Nuxt layer providing self-hosted, cookieless web analytics on CouchDB: a browser tracker (`useAnalytics()`, `v-analytics`, standalone `/a.js`), ingestion at `POST /api/stats`, rollups, realtime, reports, sessions, sharing, API keys, pixels/links, imports and an admin dashboard under `/admin/analytics/**`. The built-in engine (`analytics_mode=self_hosted`) is the focus of all new work. Forwarding to Umami Cloud (`umami_cloud`, still the default when the key is unset, and `dual`) is legacy and documented in `docs/umami-cloud-forwarding.md`.

Consuming apps (extend this layer):
- `apps/bitvocation`, `apps/couchfusioncom`, `apps/forest-cabin`, `apps/kangu`, `apps/kids-store`, `apps/lovable-gifts-sdd`, `apps/lovable-test`, `apps/nuxt-app-starter`, `apps/radustanciu`, `apps/smart-lead`, `apps/testing-1`

## Folder map

- `composables/` — `useAnalytics.ts` (client factory + composable; not under `app/`, registered via `imports.dirs`).
- `plugins/` — `analytics.client.ts` (init client + registers `v-analytics` directive), `analytics.server.ts` (SSR setup), `component-analytics.client.ts` (per-component seen tracking via sessionStorage).
- `server/api/` — `stats.post.ts` (mode pipeline: local collection and/or Umami forwarding), `stats.options.ts` (CORS preflight), `analytics/admin/[...path].ts` (admin API), `analytics/share/[token]/[...path].ts` (public share API), `analytics/v1/[...path].ts` (API-key REST API), `analytics/p/[token].ts` (tracking pixel).
- `server/routes/` — `a.js.ts` (standalone tracker), `l/[slug].ts` (tracked short links).
- `server/engine/` — self-hosted engine (explicit relative imports; deliberately not under `server/utils` so nothing is auto-imported into apps): `config` (`_config` keys), `collector`/`hit`/`queue` (ingestion), `ua`/`referrer`/`net` (enrichment), `identity` (daily salts), `couch`/`storage`/`sites`, `rollup` (visits → day rollups), `aggregator` (lease, tail cache, retention, rebuild, reset), `query` (ranges, overview, metrics, realtime), `reports` (goals, funnel, journey, retention, utm, attribution, revenue, breakdown, sessions), `platform` (API keys, pixels, links), `importer` (Umami/Fathom), `*-routes.ts` + `router.ts` (API routing), `access.ts`, specs (`p0`…`p4.spec.ts`, opt-in `integration.spec.ts`).
- `server/plugins/` — `init.ts` (mode log, DB provisioning), `aggregator.ts` (60 s aggregation loop).
- `modules/admin.ts` — registers admin pages + nav when `public.analytics.admin.enabled`.
- `admin/` — dashboard Vue code (`pages/`, `components/`, `composables/`, `utils/`), plain CSS under `.cfa` (no Tailwind dependency).
- `types/` — `umami.ts`, `umami.d.ts` (directive binding + Umami payload typings).
- `docs/` — `self-hosted-analytics.md` (operator notes), `specs/` (design spec), `umami-cloud-forwarding.md` and older Umami notes (legacy), `implementation_results/`.
- `nuxt.config.ts` — declares `#analytics` alias, `imports.dirs`, the two plugins, and `runtimeConfig.analytics` / `runtimeConfig.public.analytics` defaults.
- `README.md` + `README.html` — setup and operation guide for the built-in engine (keep both in sync; the HTML is self-contained with a diagram).

## Public API / Exports

- Composable (auto-imported): `useAnalytics()` → returns the `$analytics` client (or a fresh `createAnalyticsClient()` fallback).
- Factory: `createAnalyticsClient(initialConfig?)` — methods: `init`, `trackPageview`, `trackEvent`, `track`, `trackView`, `trackRouterNavigation`, `identify`, `isLoaded`, `getInstance`.
- Plugin-injected: `nuxtApp.$analytics` (client-side).
- Directive: `v-analytics` (client only) — binding value is string (event name) or `{ event, data?, trigger? }`; `arg` overrides the trigger (default `click`).
- Server endpoint: `POST /api/stats` — accepts `{ type, payload, sentAt }`; forwards to Umami `proxyHost`.
- Runtime config (public): `runtimeConfig.public.{appSlug, analytics.{endpoint, umami.{websiteId, hostUrl, scriptPath, dataDomains, autoTrack, excludedPaths, includeTitle, sendReferrer, debug, appName}}}`.
- Runtime config (private): `runtimeConfig.analytics.umami.proxyHost`.
- Server authority: CouchDB `_config` section `cf_env_[appSlug]`. Umami forwarding requires `umami_website_id` (optional `umami_excluded_paths`); the self-hosted engine uses the `analytics_*` keys documented in `docs/self-hosted-analytics.md`.
- Runtime config (public, self-hosted): `analytics.admin.enabled` (default false), `analytics.persistentId`, `analytics.autoCapture.{outbound,downloads,downloadExtensions}`, `analytics.umami.tag`.

## Conventions

- All layer imports go through the `#analytics` alias.
- Composables live in `composables/` (NOT `app/composables/`) — this layer predates the Nuxt 4 `app/` convention; preserve the existing path or update `imports.dirs` in `nuxt.config.ts` if moving.
- Track via `v-analytics="'event-name'"` in templates; avoid inline `addEventListener` for analytics.
- Browser-side exclusions may still be configured in `runtimeConfig.public.analytics.umami.excludedPaths`; the server proxy independently enforces CouchDB `umami_excluded_paths`. Glob suffix `*` is supported.
- Browser dispatch prefers `navigator.sendBeacon`, then `fetch(..., { keepalive: true })` — do not replace with plain `fetch` without keepalive.
- The `component-analytics.client.ts` plugin dedupes component-view tracking per session via `sessionStorage["component-analytics-seen"]`.

## Dependencies

- Runtime deps assumed from consuming app: `nuxt` (4.x), `vue` (3.5.x). No extra npm packages.
- Required: reads CouchDB `_config` section `cf_env_[appSlug]` through the Database layer (see root AGENTS.md "Environment Configuration Standard").
- The layer extends `../database`; consuming apps do not need to order the Database layer before Analytics solely for this dependency.
- Forwarding target: Umami Cloud at `runtimeConfig.analytics.umami.proxyHost` (default `https://cloud.umami.is`).

## Build / Test commands

No standalone test config or `package.json` for this layer.

- Lint/typecheck: run inside a consuming app (e.g. `apps/bitvocation`): `bun run lint`, `bun run typecheck`.
- Tests: none at layer scope. Root `layers/vitest.config.ts` covers layers that alias under `#content`/`#database`; analytics has no `#analytics` alias entry there, so add one before writing vitest specs against this layer.
- Smoke test: hit `POST /api/stats` from a running consumer app.

## Gotchas / Pitfalls

- One website per app. The engine auto-creates `site:<analytics_default_site_id or app slug>` and ignores any client-supplied website id. Don't add multi-site UI, site pickers or `data-website-id`; admin/share APIs use `site/...` and v1 has no site segment.

- Self-hosted engine: never import `server/engine/*` into app code. Nitro drops side-effect-only imports, so admin routes are composed as explicit arrays in the catch-all handler, not registered.
- Admin dashboard needs `admin_workspace` plus the `apexcharts` and `@iconify/vue` packages in the consuming app. Without `public.analytics.admin.enabled` no pages are added.
- The aggregator lease (`lock:aggregator`) is released on Nitro close. A hard-killed instance blocks aggregation for up to 3 minutes.
- Dev QA hits in `dual` mode also reach Umami Cloud. Use `self_hosted` while generating synthetic traffic.
- `admin/utils/world-dots.ts` (coarse grid + continent regions) and `world-dots-fine.ts` (2x grid, lazy-loaded on first zoom) are generated for `WorldMap.vue`. Regenerate with `scripts/generate-world-dots.mjs`; never hand-edit. The map draws on a canvas and has no runtime dependency. Click behaviour depends on zoom: at world view a click zooms into the continent; when zoomed, a click on a country with visitors filters by it and any other click zooms out.
- Country comes only from CDN headers (`CF-IPCountry` etc., `server/engine/net.ts`). No GeoIP database; `status.geo` counters show whether headers arrive.
- Dashboard theming follows the admin workspace (light by default). Don't reintroduce `prefers-color-scheme` rules; dark only applies via an ancestor `.dark` / `[data-theme="dark"]`.
- Bots include HeadlessChrome/Playwright UAs, so headless browser tests are dropped by design.

- `useAnalytics()` returns a fallback client if `$analytics` is unset on SSR — guard server-side calls or check `import.meta.client`.
- Missing CouchDB `umami_website_id` makes `/api/stats` fail closed; the proxy never accepts the client payload's website as a fallback.
- Missing required config is negative-cached for 30 seconds, and concurrent config reads are deduplicated.
- `NUXT_PUBLIC_UMAMI_EXCLUDED_PATHS` is accepted only as a legacy CouchDB exclusion key; migrate to `umami_excluded_paths`.
- `v-analytics` is registered only on the client; SSR-rendered bindings are no-ops — do not gate critical UI on directive side effects.
- `analytics.server.ts` may attempt to load the Umami script proxy; ensure `proxyHost` is reachable or events queue silently.
- Two config trees (`runtimeConfig.analytics` vs `runtimeConfig.public.analytics`) — public is for the browser, private for server forwarding. Don't mix them.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Self-hosted engine guide: `docs/self-hosted-analytics.md`
- Self-hosted engine spec (implemented P0–P4): `docs/specs/2026-10-09T19-47-30Z-self-hosted-analytics-spec.md`
- Layer docs: `README.md`, `docs/analytics-layer-umami-integration.md`, `docs/umami-config-examples.md`, `docs/umami-excluded-paths.md`, `docs/2025-11-03T15-19-39Z-umami-proxy.md`
- Related skills: `couchfusion-layer-builder`, `vuejs-development`, `vueuse`
