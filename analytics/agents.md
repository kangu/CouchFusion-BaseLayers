# Layer: analytics

Runtime: nuxt 4.x, vue 3.5.x

Reusable Nuxt layer providing self-hosted, cookieless web analytics on CouchDB: a browser tracker (`useAnalytics()`, `v-analytics`, standalone `/a.js`), ingestion at `POST /api/stats`, rollups, realtime, reports, sessions, sharing, API keys, pixels/links, imports and an admin dashboard under `/admin/analytics/**`. Collection is always on in every app that extends the layer: no mode switch, no third-party forwarding, and no required CouchDB `_config` keys (Umami Cloud support was removed on 2026-10-28).

Consuming apps (extend this layer):
- `apps/bitvocation`, `apps/couchfusioncom`, `apps/forest-cabin`, `apps/kangu`, `apps/kids-store`, `apps/lovable-gifts-sdd`, `apps/lovable-test`, `apps/nuxt-app-starter`, `apps/radustanciu`, `apps/smart-lead`, `apps/testing-1`

## Folder map

- `composables/` — `useAnalytics.ts` (client factory + composable; not under `app/`, registered via `imports.dirs`).
- `plugins/` — `analytics.client.ts` (init client + registers `v-analytics` directive), `analytics.server.ts` (SSR setup), `component-analytics.client.ts` (per-component seen tracking via sessionStorage).
- `server/api/` — `stats.post.ts` (validates and stores hits locally), `stats.options.ts` (CORS preflight), `analytics/admin/[...path].ts` (admin API), `analytics/share/[token]/[...path].ts` (public share API), `analytics/v1/[...path].ts` (API-key REST API), `analytics/p/[token].ts` (tracking pixel).
- `server/routes/` — `a.js.ts` (standalone tracker), `l/[slug].ts` (tracked short links).
- `server/engine/` — self-hosted engine (explicit relative imports; deliberately not under `server/utils` so nothing is auto-imported into apps): `config` (`_config` keys), `collector`/`hit`/`queue` (ingestion), `ua`/`referrer`/`net` (enrichment), `identity` (daily salts), `couch`/`storage`/`sites`, `rollup` (visits → day rollups), `aggregator` (lease, tail cache, retention, rebuild, reset), `query` (ranges, overview, metrics, realtime), `reports` (goals, funnel, journey, retention, utm, attribution, revenue, breakdown, sessions), `platform` (API keys, pixels, links), `importer` (Fathom Lite), `*-routes.ts` + `router.ts` (API routing), `access.ts`, specs (`p0`…`p4.spec.ts`, opt-in `integration.spec.ts`).
- `server/plugins/` — `init.ts` (mode log, DB provisioning), `aggregator.ts` (60 s aggregation loop).
- `modules/admin.ts` — registers admin pages + nav when `public.analytics.admin.enabled`.
- `admin/` — dashboard Vue code (`pages/`, `components/`, `composables/`, `utils/`), plain CSS under `.cfa` (no Tailwind dependency).
- `types/` — `analytics.ts` (client + directive binding types), `nuxt-app.d.ts` (`$analytics` augmentation).
- `docs/` — `self-hosted-analytics.md` (operator notes), `specs/` (design spec), dated notes from the former Umami integration (history only), `implementation_results/`.
- `nuxt.config.ts` — declares `#analytics` alias, `imports.dirs`, the two plugins, and `runtimeConfig.analytics` / `runtimeConfig.public.analytics` defaults.
- `README.md` + `README.html` — setup and operation guide for the built-in engine (keep both in sync; the HTML is self-contained with a diagram).

## Public API / Exports

- Composable (auto-imported): `useAnalytics()` → returns the `$analytics` client (or a fresh `createAnalyticsClient()` fallback).
- Factory: `createAnalyticsClient(initialConfig?)` — methods: `init`, `trackPageview`, `trackEvent`, `track`, `trackView`, `trackRouterNavigation`, `identify`, `isLoaded`, `getInstance`.
- Plugin-injected: `nuxtApp.$analytics` (client-side).
- Directive: `v-analytics` (client only) — binding value is string (event name) or `{ event, data?, trigger? }`; `arg` overrides the trigger (default `click`).
- Server endpoint: `POST /api/stats` — accepts `{ type, payload, sentAt }` and stores the hit; always answers `{ ok: true }` for a valid body.
- Runtime config (public): `runtimeConfig.public.{appSlug, analytics.{endpoint, includeTitle, sendReferrer, debug, tag, persistentId, autoCapture.{outbound,downloads,downloadExtensions}, admin.enabled}}`.
- Server settings: optional `analytics_*` keys in CouchDB `_config` section `cf_env_[appSlug]` (see `docs/self-hosted-analytics.md`). Every key has a default.

## Conventions

- All layer imports go through the `#analytics` alias.
- Composables live in `composables/` (NOT `app/composables/`) — this layer predates the Nuxt 4 `app/` convention; preserve the existing path or update `imports.dirs` in `nuxt.config.ts` if moving.
- Track via `v-analytics="'event-name'"` in templates; avoid inline `addEventListener` for analytics.
- Excluded paths live only on the website record (Settings → Website; defaults for new sites `/admin*`, `/login`, `/builder`, `/builder/*`, `/k`, `/k/*`). Glob suffix `*` is a prefix match, so exclude `/k` and `/k/*`, not `/k*` (that would hide `/kids`). The default only applies when the site record is created; existing sites change in Settings. There is no `_config` or runtime-config exclusion list.
- Builder previews are never tracked: a page loaded with `?inline-preview` (the content builder's live-preview iframe) sends nothing from any client of `composables/useAnalytics.ts` for its whole lifetime (`PREVIEW_QUERY_PARAMS`, decided once at load). `composables/useAnalytics.spec.ts` covers it.
- Browser dispatch prefers `navigator.sendBeacon`, then `fetch(..., { keepalive: true })` — do not replace with plain `fetch` without keepalive.
- The `component-analytics.client.ts` plugin dedupes component-view tracking per session via `sessionStorage["component-analytics-seen"]`.

## Dependencies

- Runtime deps assumed from consuming app: `nuxt` (4.x), `vue` (3.5.x). No extra npm packages.
- Required: reads CouchDB `_config` section `cf_env_[appSlug]` through the Database layer (see root AGENTS.md "Environment Configuration Standard").
- The layer extends `../database`; consuming apps do not need to order the Database layer before Analytics solely for this dependency.

## Build / Test commands

No standalone test config or `package.json` for this layer.

- Lint/typecheck: run inside a consuming app (e.g. `apps/bitvocation`): `bun run lint`, `bun run typecheck`.
- Tests: `cd layers && npx vitest run --config vitest.config.ts analytics`. The shared setup file (`_tests/setup/content.ts`) needs a local CouchDB; without one, run with a config that sets `setupFiles: []` (the analytics specs don't use it).
- Smoke test: hit `POST /api/stats` from a running consumer app.

## Gotchas / Pitfalls

- One website per app. The engine auto-creates `site:<analytics_default_site_id or app slug>` and ignores any client-supplied website id. Don't add multi-site UI, site pickers or `data-website-id`; admin/share APIs use `site/...` and v1 has no site segment.

- Self-hosted engine: never import `server/engine/*` into app code. Nitro drops side-effect-only imports, so admin routes are composed as explicit arrays in the catch-all handler, not registered.
- Admin dashboard needs `admin_workspace` plus the `apexcharts` and `@iconify/vue` packages in the consuming app. Without `public.analytics.admin.enabled` no pages are added.
- The aggregator lease (`lock:aggregator`) is released on Nitro close. A hard-killed instance blocks aggregation for up to 3 minutes.
- Dashboard filters live in the route query (`useAnalyticsState`), which updates asynchronously. When one action adds several filters, call `state.addFilters(...)` once; consecutive `addFilter` calls drop all but the last. A `prop` filter value is `key=value`; property table rows are `event␟key␟value` (`\u001f`), and `formatDimValue` renders both.
- `admin/utils/world-dots.ts` (coarse grid + continent regions) and `world-dots-fine.ts` (2x grid, lazy-loaded on first zoom) are generated for `WorldMap.vue`. Regenerate with `scripts/generate-world-dots.mjs`; never hand-edit. The map draws on a canvas and has no runtime dependency. Click behaviour depends on zoom: at world view a click zooms into the continent; when zoomed, a click on a country with visitors filters by it and any other click zooms out.
- Client IP and geo-header trust: `net.ts` `resolveClient(event, config.trustHeaders)` — always use it, never read `cf-connecting-ip`/`x-real-ip`/geo headers directly. `auto` trusts Cloudflare headers only when the connecting address (socket peer, or the local proxy's `X-Real-IP` / last XFF hop when the peer is loopback/private) is in `CLOUDFLARE_RANGES`; other CDN headers need `all`. This relies on the reverse proxy overwriting `X-Real-IP` (the githooker Caddy template does).
- Country: `server/engine/geo.ts` `resolveGeo` — CDN headers (`net.ts` `geoFromHeaders`) first, then the browser time zone (`payload.timezone`, sent by both trackers) through the generated `tz-country.ts` table (`analytics_geo_source` = auto | header | timezone | none, default auto). The zone is client input: only exact table names count (Map lookup, ≤64 chars). Time zone gives country only. Regenerate the table with `scripts/generate-tz-country.mjs`; never hand-edit it. No GeoIP database; `status.geo` counts hits with a country and how many came from the time zone.
- Dashboard theming follows the admin workspace (light by default). Don't reintroduce `prefers-color-scheme` rules; dark only applies via an ancestor `.dark` / `[data-theme="dark"]`.
- Bots include HeadlessChrome/Playwright UAs, so headless browser tests are dropped by design.

- `useAnalytics()` returns a fallback client if `$analytics` is unset on SSR — guard server-side calls or check `import.meta.client`.
- Engine config is read as one `_config` section (`readConfigSection`, strict: throws on failure) and cached for 60 s. Never switch it back to the shared `readCouchConfigValues`, which turns failures into "unset" (that silently swaps in defaults: wrong DB prefix, shorter retention). On failure the last good config is served; before any loaded, `config.loaded === false` and every writer must refuse (`assertConfigLoaded`, collector "unavailable", aggregator/retention skip).
- All CouchDB calls go through `couch()` in `server/engine/couch.ts`, which applies timeouts (15 s; `LONG_TIMEOUT_MS` 60 s for scans/bulk/db ops) and maps network failures to `CouchError` 503/504. Don't call `couchDBRequest` or `fetch` directly from the engine.
- The raw-event queue retries failed batches with backoff and keeps them at the front of the buffer; per-doc `conflict` means "already written". The aggregator's tail scan is clamped to `oldestPendingTs()`; keep that if you change either side, or late-written events vanish from today's totals.
- Request bodies are read with `readLimitedBody` (`server/engine/body.ts`), never h3 `readBody`. Routes can raise the limit with `maxBody`; the router authenticates before reading the body.
- Aggregator: today's rollup is recomputed only when the tail gained events (`dirty`); yesterday is recomputed at most every 15 min while open (`YESTERDAY_RECOMPUTE_MS`). Rebuild/backfill skip days whose raw shards are gone (`firstCompleteRawMonth`: retention cutoff and `meta:retention.droppedThrough`, written before each shard drop); never let a recompute overwrite a rollup without raw coverage. Reset deletes in pages via `scanIds` and writes `reset:<site>`; every leader checks it each tick and drops its tail.
- `localDay` / `localHour` use a bounded per-zone 15-minute offset cache (exact for all current zones). Use them, not `localParts`, on per-event paths.
- Router pageviews (`plugins/analytics.client.ts`) skip navigation failures and repeat URLs (hash ignored unless `public.analytics.trackHashChanges`), and are sent on unhead `dom:rendered` (300 ms fallback, flushed on `pagehide` or the next navigation) so the title matches the page.
- Never spread large arrays into `push(...arr)` (RangeError above ~125k items); raw reads can return hundreds of thousands of events.
- Some apps still carry a dead `public.analytics.umami { ... }` block, `data-umami-event` attributes or `window.umami` calls. None of these do anything; use `v-analytics` / `useAnalytics()` instead.
- `v-analytics` is registered only on the client; SSR-rendered bindings are no-ops — do not gate critical UI on directive side effects.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Self-hosted engine guide: `docs/self-hosted-analytics.md`
- Self-hosted engine spec (implemented P0–P4): `docs/specs/2026-10-09T19-47-30Z-self-hosted-analytics-spec.md`
- Layer docs: `README.md` (+ `README.html`, keep in sync)
- Related skills: `couchfusion-layer-builder`, `vuejs-development`, `vueuse`
