# Self-hosted analytics engine

The analytics layer can store and analyse traffic in CouchDB itself, with feature parity targets of Fathom Lite and Umami. Spec and parity matrix: `docs/specs/2026-10-09T19-47-30Z-self-hosted-analytics-spec.md`.

## Modes (`cf_env_[slug].analytics_mode`)

| Mode | Local storage | Umami Cloud forwarding |
|---|---|---|
| `umami_cloud` (default) | no | yes (original behaviour, unchanged) |
| `dual` | yes | best effort (failures logged, never break ingestion) |
| `self_hosted` | yes | no |

The mode is re-read every 60 s, so switching it needs no restart.

## Enabling it in an app

1. `extends`: the app needs `../../layers/database`, `../../layers/auth`, `../../layers/analytics` and `../../layers/admin_workspace` (for the admin layout).
2. Install the dashboard dependencies in the app: `bun add apexcharts @iconify/vue`.
3. `runtimeConfig.public.analytics.admin.enabled = true`. This registers `/admin/analytics/**` and adds the "Analytics" sidebar section. Apps that don't set this get no pages.
4. CouchDB `_config` → `cf_env_[slug]`: set `analytics_mode=self_hosted`.
5. Open `/admin/analytics/settings` and review the website: name, timezone, domains, excluded paths.

**One website per app.** Each app tracks only itself. The website record (`site:<id>`, id = `analytics_default_site_id` or the app slug) is created automatically on first start. There is no website list, no "add website", and the tracker sends no website id; a client-supplied `payload.website` is ignored. The admin and share APIs address it as `site/...`, and the v1 API has no site segment (`/v1/stats`, `/v1/metrics/:dim`, …).

The Nuxt client tracker (`useAnalytics()`, `v-analytics`, router pageviews) needs no changes.

## `_config` keys (flat, `cf_env_[slug]`)

| Key | Default | Meaning |
|---|---|---|
| `analytics_mode` | `umami_cloud` | see above |
| `analytics_default_site_id` | app slug | id of the app's single website record; rarely needs setting |
| `analytics_db_prefix` | `analytics_<slug>` | main DB name; raw shards are `<prefix>_raw_<yyyy>_<mm>` |
| `analytics_raw_retention_months` | `13` | raw month shards older than this are dropped (rollups kept forever) |
| `analytics_respect_dnt` | `true` | drop hits with `DNT: 1` or `Sec-GPC: 1` |
| `analytics_ignore_ips` | — | comma-separated IPs/CIDRs (v4 and v6) |
| `analytics_geo_source` | `header` | `header` (Cloudflare / CloudFront / Vercel country, region and city headers) or `none` |
| `analytics_aggregator_enabled` | `true` | set `false` on instances that shouldn't aggregate |
| `analytics_persistent_id` | `false` | accept the opt-in first-party id (needs consent; also set `public.analytics.persistentId`) |
| `analytics_max_scan_days` | `31` | upper bound for filtered queries, reports and sessions |
| `umami_website_id`, `umami_excluded_paths` | — | still used for forwarding; `umami_excluded_paths` also applies locally |

Most of these can be edited under Settings → Engine (not the db prefix or the site id).

## Privacy model

- No cookies. Visitor = `sha256(dailySalt | site | ip | ua)`, truncated to 64 bits. Salts are random per site-local day and deleted after 2 days.
- IP and raw user agent are never stored. Only browser/OS/device buckets, CDN country/region/city, screen and language are kept.
- Visitors are unique per day. Range totals are the sum of daily uniques (Fathom/Plausible model).
- Cross-day features (retention, multi-day attribution) work only with `identify(id)` or the opt-in persistent id.
- Bots (crawler, preview, headless and script UAs) are dropped server-side.

## Data model (CouchDB, all admin-only `_security`)

- `<prefix>` (main): `site:<id>`, `agg:<site>:<yyyymmdd>` (day rollups), `imp:<site>:<yyyymmdd>` (imported Fathom rollups), `salt:<day>`, `state:<site>`, `lock:aggregator`, `segment:*`, `report:*`, `apikey:<sha256>`, `pixel:<token>`, `link:<slug>`.
- `<prefix>_raw_<yyyy>_<mm>`: raw hits with id `<site>:<ts13>:<rand>`. Ids sort by time per site, so every read is an `_all_docs` range and no views are needed.
- The aggregator is a Nitro plugin that runs every 60 s while holding a CouchDB lease (released on shutdown). It recomputes today's rollup from an in-memory tail of today's events, finalises yesterday after a 3 h margin, backfills missed days (3 per tick), and runs retention and salt purges hourly.
- Unfiltered dashboards read rollups. Filters, "last 24 hours", reports and sessions scan raw events, bounded by `analytics_max_scan_days`.

## HTTP surface

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/stats` (+ `OPTIONS`) | public; CORS for registered domains | ingestion (JSON or `text/plain`) |
| `GET /a.js` | public | standalone tracker for non-Nuxt sites (Umami-compatible `data-*` attributes and `umami.track/identify`) |
| `/api/analytics/admin/**` | CouchDB session; `admin`, or a role in `site.allowedRoles` | dashboard API |
| `/api/analytics/share/:token/**` | share token | read-only dashboard API |
| `/api/analytics/v1/**` | `Authorization: Bearer cfa_…` | read-only REST API |
| `GET /api/analytics/p/:token.gif` | public | tracking pixel (`pixel-view` event) |
| `GET /l/:slug` | public | tracked short link (`link-click` event, then 302) |

Admin pages: `/admin/analytics` (overview), `/realtime`, `/events`, `/sessions`, `/reports`, `/settings`, `/tools` (pixels, links, import), `/api-keys`, and the public `/admin/analytics/share/:token`. The share page lives under `/admin` because that prefix is reserved by the content layer, so its catch-all never claims it. It needs no login.

## Client additions

- `useAnalytics().identify(id?, data?)`: attaches an app user id to later hits and sends session properties.
- `runtimeConfig.public.analytics.persistentId`: opt-in localStorage id (`cfa.pid`).
- `runtimeConfig.public.analytics.autoCapture.{outbound, downloads, downloadExtensions}`: automatic `outbound-link-click` and `file-download` events.
- `runtimeConfig.public.analytics.umami.tag`: tag every hit (A/B variant, deploy, …).
- Revenue: send events with `revenue` (number) and `currency` (ISO code) properties.

## Rollout guide (per app)

1. Enable the admin module (above) and set `analytics_mode=dual`.
2. Run for 14 days. Compare visitors, pageviews and bounce with Umami Cloud. Expect visitors to read higher, because uniques are daily instead of monthly.
3. When the numbers are acceptable, switch to `analytics_mode=self_hosted` (Websites → App settings). Forwarding stops immediately.
4. Optional: import Umami history (Tools → Import → `website_event` and `session` CSVs).
5. Once no app uses `umami_cloud` or `dual`, remove the forwarding code (`forwardToUmami` in `server/api/stats.post.ts`, `server/utils/umami-config.ts`) and the `umami_*` keys.

## Testing

- Unit: `cd layers && npx vitest run --config vitest.config.ts analytics`
- CouchDB integration (throwaway DB prefix, cleaned up afterwards): `ANALYTICS_IT=1 COUCHDB_ADMIN_AUTH=… npx vitest run --config vitest.config.ts analytics/server/engine/integration`

## Theming

The dashboard UI uses the admin workspace's light look: white cards, gray-200 borders and an orange accent. It never follows the OS dark-mode setting by itself. Dark mode only applies when the workspace opts in: a `dark` class or `data-theme="dark"` on any ancestor, for example via `appConfig.adminWorkspace.themeClass`. All colors, including the ApexCharts palette, come from the `--cfa-*` tokens in `admin/components/AnalyticsFrame.vue`.
