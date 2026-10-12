# Self-hosted Analytics Engine — Spec & Phased Plan

Status: **Implemented P0–P4** (2026-10-09). The Q7 validation gate (14 days of `dual` on kangu) is pending real traffic. Operator guide: `docs/self-hosted-analytics.md`. · Date: 2026-10-09 · Layer: `layers/analytics` · Pilot app: `apps/kangu`

## 1. Decisions taken

| # | Decision | Choice |
|---|----------|--------|
| A | Layer strategy | **Evolve `layers/analytics`** into a self-hosted engine. Umami Cloud forwarding stays as an optional mode. The public client API (`useAnalytics()`, `v-analytics`, `POST /api/stats`) does not change for the 13 consuming apps. |
| B | Storage | **CouchDB only**: raw events plus pre-aggregated rollup documents, following Fathom's aggregation model. |
| C | Admin module | **On `layers/admin_workspace`**: pages under `/admin/analytics/**` with the `admin-workspace` layout and nav from `appConfig.adminWorkspace.sections`. |
| D | Pilot | **`apps/kangu`** |
| E | Deliverable | This spec. No code yet. |
| Q1 | Identity | Daily-salted visitor hash (Fathom model). `analytics_persistent_id` stays an opt-in. |
| Q2 | Retention | Raw events kept for 13 months. Rollups kept forever. |
| Q3 | Aggregator host | In-app Nitro plugin with a lease doc. No external worker. |
| Q4 | Geo | CDN headers only (country, plus region/city where the CDN provides them). No MaxMind. |
| Q5 | Charts | `apexcharts`, reused from the monorepo. |
| Q6 | Dashboard scope | One dashboard per app, reading only that app's analytics DBs. |
| Q7 | Umami Cloud | Forwarding is turned off once P2 is validated. |

Reference products:
- **Fathom Lite**: https://github.com/usefathom/fathom. This is the open-source Go app the link points to, not Fathom's paid SaaS.
- **Umami** v2/v3: https://github.com/umami-software/umami.

## 2. Current state (baseline)

- `layers/analytics` is a **stateless Umami Cloud proxy**:
  - The client tracker in `composables/useAnalytics.ts` builds an Umami-shaped payload (`hostname, language, screen, url, referrer, title, name, data`) and sends it with `sendBeacon` or `fetch(keepalive)`.
  - `server/api/stats.post.ts` applies path exclusions, overwrites `website` with the CouchDB `umami_website_id`, and forwards to `cloud.umami.is/api/send`.
  - Config is read from CouchDB `_config` → `cf_env_[appSlug]` (`server/utils/umami-config.ts`).
  - Other client pieces: the `v-analytics` directive, and `component-analytics.client.ts` for per-session component views.
- **No storage, no dashboard, no admin pages.**
- 13 apps extend the layer: bitvocation, couchfusioncom, forest-cabin, kangu, kids-store, lovable-gifts-sdd, lovable-test, mindarchy, nuxt-app-starter, radustanciu, smart-lead, testing-1, ylemreef.
- `layers/admin_workspace` provides the `admin-workspace` layout and role-aware sidebar.
  - **Kangu does not extend it yet**, but `layers/content/app/pages/admin/pages.vue` already requests `layout: "admin-workspace"`.
  - The pilot therefore needs `../../layers/admin_workspace` in kangu's `extends`, which also fixes that page's layout.
- Server admin guard: `#auth` `assertAdminSession(event)`. It reads the CouchDB `AuthSession` cookie, requires the `admin` role, and returns 404 otherwise.
- Client admin guard: `middleware: ["auth", "role-auth"]` with `authAllowedRoles`.

## 3. Feature-parity matrix

Legend: ✅ supported · ◐ partial · — not present. **Phase** = when we ship it (see §6).

### 3.1 Collection / tracker

| Feature | Fathom Lite | Umami | Phase | Notes for our implementation |
|---|---|---|---|---|
| Cookieless tracking, no IP stored | ✅ | ✅ | P0 | Visitor hash = `sha256(dailySalt + siteId + ip + ua)`. The IP is never persisted. |
| Respect Do-Not-Track | ✅ | ✅ (`data-do-not-track`) | P0 | Config `analytics_respect_dnt`, default `true`. |
| Bot filtering | ✅ | ✅ (isbot) | P0 | `isbot` (Unlicense) applied server-side. |
| Pageview auto-tracking (SPA router) | ✅ | ✅ | exists | Already in the Nuxt plugin. |
| Custom events | — (Pro only) | ✅ `umami.track()` | exists → P0 store | Already sent. Stored from P0. |
| Event properties | — | ✅ | P2 | Flat key/values. Caps: 20 keys, 200-character values. |
| Identify / session properties | — | ✅ `umami.identify()` | P3 | Adds `identify(distinctId?, data?)` to the client. |
| Revenue events | — | ✅ (revenue + currency) | P3 | Uses the reserved `revenue` and `currency` event-data keys. |
| Standalone `<script>` for non-Nuxt sites | ✅ | ✅ | P2 | Served at `/a.js`. Accepts the same `data-*` attributes as Umami (`website-id, host-url, auto-track, domains, tag, exclude-search, exclude-hash, do-not-track, before-send`). |
| Domain allow-list | — | ✅ `data-domains` | P2 | Checked against the site doc on ingestion. |
| Exclude search / hash | — | ✅ | P2 | Tracker option, plus server-side stripping of non-UTM query params. |
| Path exclusions | — | — | exists | `umami_excluded_paths` moves to the site doc, with the old key as fallback. |
| IP exclusion (own traffic) | — | ✅ `IGNORE_IP` | P2 | `analytics_ignore_ips` (CIDR list). |
| Tags (`data-tag`) | — | ✅ | P2 | Stored as a dimension. |
| Tracking pixel | — | ✅ (v2.17+ "Pixels") | P4 | `/api/analytics/p/<token>.gif` |
| Tracked short links | — | ✅ (v2.17+ "Links") | P4 | `/l/<slug>` redirects and records a click event. |
| Outbound link / download tracking | — | via `data-umami-event` | P2 | Opt-in auto-capture, plus the existing `v-analytics`. |

### 3.2 Metrics & dimensions (dashboard)

| Feature | Fathom Lite | Umami | Phase | Notes |
|---|---|---|---|---|
| Unique visitors | ✅ | ✅ | P1 | Daily uniques. A date range shows the sum of daily uniques (the Fathom/Plausible model). See §4.4. |
| Pageviews | ✅ | ✅ | P1 | |
| Visits / sessions | — | ✅ | P1 | A visit ends after 30 minutes of inactivity. |
| Bounce rate | ✅ | ✅ | P1 | A bounce is a visit with one pageview and no events. |
| Avg. visit duration / time on page | ✅ | ✅ | P1 | Measured from the last hit to the visit start. Bounces count as 0 s. |
| Realtime (current visitors, last 30 min) | ✅ | ✅ | P1 | Read live from raw events (§4.5). |
| Top pages | ✅ | ✅ | P1 | |
| Entry / exit pages | — | ✅ | P2 | |
| Page titles | — | ✅ | P2 | |
| Referrers (grouped by domain) | ✅ | ✅ | P1 | Referrer grouping such as `google.*` → Google. |
| Channels (direct / search / social / email / paid / referral) | — | ✅ | P2 | Rule table in the layer. |
| UTM source / medium / campaign / term / content | — | ✅ | P2 | |
| Hostnames | — | ✅ | P2 | |
| Browsers / OS / device type | — | ✅ | P2 | UA parsing with `bowser` (MIT). Avoid `ua-parser-js` v2, which is AGPL. |
| Screen sizes | — | ✅ | P2 | |
| Languages | — | ✅ | P2 | |
| Countries / regions / cities + map | — | ✅ | P2 | CDN headers only (§4.2). Region and city appear only when the CDN sends them. |
| Events + counts + property breakdown | — | ✅ | P2 | |
| Chart over time (hour / day / month) | ✅ | ✅ | P1 | |
| Date ranges + custom range | ✅ | ✅ | P1 | Today, 24h, 7d, 30d, this month, last month, 90d, 12m, custom. |
| Compare to previous period | — | ✅ | P2 | |
| Filters (any dimension, combinable) | — | ✅ | P2 | Answered from raw events. Not possible with rollups (§4.6). |
| Segments / cohorts (saved filters) | — | ✅ (v2.18+/v3) | P3 | |
| Timezone per site | — | ✅ | P1 | Rollup buckets are calculated in the site's timezone. |

### 3.3 Reports

| Report | Fathom Lite | Umami | Phase | Notes |
|---|---|---|---|---|
| Goals | — | ✅ | P3 | Goals are a pageview path or an event name, with a conversion rate. |
| Funnels | — | ✅ | P3 | Ordered steps within one visit, with a time window. |
| User journeys | — | ✅ | P3 | Path sequences, 3–7 steps. |
| Retention | — | ✅ | P3 | **Needs cross-day identity.** Only works with `identify()` or the opt-in persistent-id mode (§4.4). |
| UTM report | — | ✅ | P3 | |
| Attribution (first / last click) | — | ✅ | P3 | |
| Revenue | — | ✅ | P3 | |
| Insights / breakdown (multi-dimension pivot) | — | ✅ | P3 | |
| Sessions explorer (per-visit event timeline) | — | ✅ | P3 | |

### 3.4 Administration / platform

| Feature | Fathom Lite | Umami | Phase | Notes |
|---|---|---|---|---|
| Multiple websites per instance | ✅ | ✅ | P1 | `site:<id>` docs. |
| Website CRUD + tracking-code snippet | ✅ | ✅ | P1 | |
| Reset / delete website data | — | ✅ | P2 | Drops raw-event DBs and rollup docs. |
| Public share link (read-only dashboard) | ✅ (public site toggle) | ✅ | P2 | Token-based `/share/analytics/<token>`. |
| Users & roles | ◐ (CLI users) | ✅ admin / user / view-only | P1 (admin) → P4 (viewer) | Uses CouchDB `_users` roles: `admin`, `analytics_viewer`. |
| Teams | — | ✅ | P4 | Maps to CouchDB roles per site (`site.allowedRoles`). |
| API + API keys | ◐ (internal JSON API) | ✅ | P4 | Bearer keys stored hashed in the analytics DB. |
| Data export (CSV) | — | ✅ | P2 | |
| Data import (Umami CSV / Fathom export) | — | ✅ (cloud) | P4 | |
| Data retention policy | — | ◐ | P2 | Month-sharded raw DBs are dropped whole (§4.3). |
| Dark mode | ✅ | ✅ | P1 | Follows admin_workspace theming. |
| UI i18n | — | ✅ | later | English first. Strings go in a single module. |
| Umami Cloud forwarding | n/a | n/a | exists | `analytics_mode=umami_cloud` or `dual`. |

**Out of scope (deliberately):** Fathom Pro and Umami Cloud SaaS features beyond what is listed above, such as email reports, billing and uptime monitoring.

## 4. Architecture

### 4.1 Modes (back-compat)

Set with the CouchDB key `cf_env_[slug].analytics_mode`:

- `umami_cloud` (**default**, today's behaviour). Nothing changes for apps that don't opt in.
- `self_hosted`: events are only stored locally.
- `dual`: events are stored locally *and* forwarded to Umami Cloud. Use this for migration and for validating numbers against Umami.

The `/api/stats` contract stays the same. The handler becomes a pipeline: `validate → resolve site → exclusions → enrich → [store] → [forward]`.

### 4.2 Ingestion pipeline (`server/utils/collector/*`)

1. **Validate.** Body cap 8 KB. The type must be `event` or `identify`. Cap URL, title and event-data sizes.
2. **Resolve site.**
   - On the Nuxt plugin path, the site comes from `analytics_default_site_id` in `_config`. As today, the client value is ignored.
   - On the standalone script path, the site comes from `payload.website`, validated against the `site:<id>` doc's `domains`.
3. **Exclude.** Drop the hit if any of these match: excluded paths, ignored IPs, DNT (if respected), bot UA, or a disabled site. Return `{ ok: true }` either way, so the client can't tell the route was ignored.
4. **Enrich.**
   - Parse the UA into browser, os and device.
   - Geo, chosen with `analytics_geo_source`:
     - `header` (default): `cf-ipcountry`, `cloudfront-viewer-country`, `x-vercel-ip-country`, plus their region/city headers when present.
     - `none`.
     - MaxMind is out of scope (Q4). Region and city stay empty when the CDN doesn't send them.
   - Referrer: domain grouping and channel.
   - UTM: parsed from the URL. Other query params are stripped unless the site has `keepQuery`.
   - Visitor hash and visit id (§4.4).
5. **Store.** Batch the raw event into an in-memory queue, then `_bulk_docs` every 1 s or every 200 events. Flush on Nitro `close`. *Trade-off:* a crash loses at most 1 s of events.
6. **Rate limit.** In memory, per visitor hash (default 30 hits per 10 s).

### 4.3 CouchDB layout

All database names come from `analytics_db_prefix`, default `analytics_<slug>`.

| Database | Kind | Contents |
|---|---|---|
| `analytics_<slug>` | normal | `site:<id>`, `agg:*` rollups, `salt:<yyyymmdd>`, `report:*` saved reports, `segment:*`, `apikey:*`, `share:*`, `lock:aggregator`, `cursor:*` |
| `analytics_<slug>_raw_<yyyy>_<mm>` | **partitioned** | Raw events. Partition key `<siteId>-<yyyymmdd>`. Doc id `<partition>:<ulid>`. |

Why month-sharded, partitioned raw DBs:
- **Retention is a whole-DB `DELETE`.** CouchDB deletes leave tombstones and are expensive, so deleting old databases is cheaper than deleting old documents.
- **Day-scoped work is cheap.** Partition queries (`/_partition/<p>/_all_docs`, `_find`) are local to a shard.

Raw event doc (short keys to keep storage small):

```jsonc
{
  "_id": "kangu-20261009:01J9...",
  "t": "pv",              // pv | ev | id (identify)
  "ts": 1760039250123,
  "v": "<visitorHash>",   // daily-salted
  "s": "<visitId>",       // v + visit start
  "p": "/pricing", "h": "kangu.ro", "ti": "Pricing",
  "r": "news.ycombinator.com", "rp": "/item", "ch": "social",
  "utm": { "s": "hn", "m": null, "c": null, "t": null, "ct": null },
  "br": "Firefox", "os": "macOS", "dv": "desktop", "sc": "1512x982",
  "lg": "ro-RO", "cc": "RO", "rg": "B", "ci": "Bucharest",
  "n": "signup-click",      // event name (t=ev)
  "d": { "plan": "pro" },   // event data, flat
  "tg": null, "uid": null   // tag, identified distinct id
}
```

Rollup doc `agg:<site>:<grain>:<bucket>`:
- `grain` is `h` (hour) or `d` (day). Month and year views are merged from day docs at query time.
- Fields: `totals{visitors, visits, pageviews, bounces, duration, events}` and per-dimension maps such as `{ "/pricing": {pv, v, e, b, dur} }`.
- Dimensions: path, entry, exit, title, referrer, channel, utm\*, host, browser, os, device, screen, language, country, region, city, event, event-prop.
- Each map is capped at the top 500 entries plus `(other)`. This keeps docs under about 1 MB.

Design docs are pushed from `server/plugins/init.ts`, following the existing pattern. Required views:
- Raw: `by_ts` (realtime).
- Main: `sites_by_domain`, `share_by_token`, `apikey_by_hash`.

### 4.4 Identity model (privacy trade-off, needs sign-off)

- **Visitor hash** = `sha256(salt_today ‖ siteId ‖ ip ‖ ua)`.
  - A random salt per UTC day is stored in `salt:<yyyymmdd>`. Salts older than 2 days are deleted.
  - Once a salt is gone, nobody can re-identify visitors from the hash. This is Fathom's model and needs no cookie consent.
- **Visit id**: a new visit starts after 30 minutes of inactivity. The aggregator tracks this per visitor.
- **Consequence (deviation from Umami):** visitors are unique *per day*. "Visitors over 30 days" is the sum of daily uniques, as in Fathom and Plausible. Umami uses a monthly salt and counts exact distinct visitors per month.
- **Cross-day reports** (retention, multi-day attribution) only work with one of these:
  - `identify(distinctId)` from apps with logged-in users. It goes in `uid`.
  - **Opt-in** `analytics_persistent_id=true`: the client keeps a first-party localStorage id. The consuming site must have consent in place.

### 4.5 Aggregator (single writer)

- Runs as a Nitro server plugin with a 60 s interval, when `analytics_aggregator_enabled=true` (default on).
- Multiple instances use a lease doc, `lock:aggregator`, with a TTL and renewal. It runs in-app only (Q3), with no external worker.
- Algorithm:
  1. Read the raw DB `_changes` since `cursor:<rawdb>`.
  2. Fold events into an in-process **day state** per site: `visitorHash → {visits[], pageviews, firstTs, lastTs, entry, exit, …}`.
  3. Recompute and overwrite the affected `agg:h:*` and `agg:d:*` docs. This is idempotent, so `_rev` conflicts are retried.
  4. Advance the cursor.
- On restart, rebuild today's day state by scanning today's partitions. Earlier days are already final.
- **Late events:** a visit straddling midnight is attributed to its start day. Data older than 2 days is final.
- **Scale target for v1:** about 1M events per day per app on one Node process. Above that, revisit the aggregator host (out of scope for now). Raw data is kept, so rollups can always be rebuilt (`POST /api/analytics/admin/rebuild`).
- **Realtime:** query the raw DB `by_ts` view for `ts > now − 30 min` and count distinct `v`, live pages and live referrers. Poll every 10 s from the admin UI. A websocket push is an optional later step that would reuse the auth layer's websocket pattern.

### 4.6 Query layer (`server/utils/query/*`)

- **Unfiltered dashboard:**
  1. Read rollup docs with a range on `_all_docs` (`agg:<site>:d:<from>` … `<to>`, using `h` for ranges of 2 days or less).
  2. Merge the dimension maps.
  3. Sort, take the top N, and paginate.
- **Filtered dashboard and all reports:** scan the raw partitions in the range server-side and stream results.
  - Range is capped by `analytics_max_scan_days` (default 31). The UI explains the cap.
  - Results are cached for 5 min in an LRU keyed by `(site, range, filters)`.
- **Compare:** run the same query over the previous equivalent range.

### 4.7 HTTP API

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/stats` | public (CORS per site domains) | Ingestion. Contract unchanged. |
| `GET /a.js` | public | Standalone tracker. Phase 2. |
| `GET /api/analytics/admin/sites` and CRUD | `assertAdminSession` | Websites |
| `GET /api/analytics/admin/sites/:id/stats?from&to&grain&filters&compare` | admin / viewer role | KPIs + series |
| `GET …/metrics/:dimension` | admin / viewer role | Top-N tables |
| `GET …/realtime` | admin / viewer role | |
| `POST …/reports/:type` | admin / viewer role | funnel, journey, retention, goals, utm, attribution, revenue, breakdown |
| `GET …/sessions`, `…/sessions/:visitId` | admin | Session explorer |
| `GET …/export.csv` | admin | |
| `POST …/reset`, `POST /api/analytics/admin/rebuild` | admin | |
| `GET /api/analytics/share/:token/*` | share token | Read-only subset |
| `/api/analytics/v1/*` | API key (Bearer) | External API. Phase 4. |

The role guard is a new `assertAnalyticsAccess(event, siteId, level)`. It builds on `#auth` `getSession`: `admin` sees everything, and `analytics_viewer` sees the sites listed in `site.allowedRoles`. Unauthorized requests get 404, matching the existing admin convention.

### 4.8 Admin module (on `admin_workspace`)

- Pages live in `layers/analytics/app/pages/admin/analytics/**`:
  - `definePageMeta({ layout: "admin-workspace", middleware: ["auth", "role-auth"], authAllowedRoles: ["admin", "analytics_viewer"] })`.
  - The layout should be registered with a `pages:extend` module, the same way `layers/database/utils/register-layout.ts` does it, so host apps can override it.
- The nav section comes from `appConfig.adminWorkspace.sections` in the layer's `nuxt.config.ts`:

```
Analytics
  Overview        /admin/analytics                  (site switcher, range, compare, filters)
  Realtime        /admin/analytics/realtime
  Events          /admin/analytics/events
  Sessions        /admin/analytics/sessions         (P3)
  Reports         /admin/analytics/reports[/:type]  (P3)
  Websites        /admin/analytics/websites[/:id]   (settings, tracking code, share, exclusions, reset)
  API keys        /admin/analytics/api-keys         (P4)
Public: /share/analytics/:token (no admin layout)
```

- **Overview layout:**
  - KPI row: visitors, visits, pageviews, bounce, duration, each with a delta.
  - Time-series chart.
  - Tables: Pages (with Entry/Exit tabs), Sources (Referrers, Channels and UTM tabs), Environment (Browser, OS, Device, Screen), Location (map plus Country, Region and City), Languages, Events.
  - Clicking any row adds a filter.
- **Charts:** `apexcharts`, reused from the monorepo (Q5). The admin pages load it client-side only. The map is an inlined world SVG with no external tiles, which matches the repo's inline-SVG convention.
- **Components:** `layers/analytics/app/components/admin/*` are layer-internal, not content-builder components, so no `builderFieldMeta` is needed.

### 4.9 `_config` keys (`cf_env_[slug]`, flat)

| Key | Default | Notes |
|---|---|---|
| `analytics_mode` | `umami_cloud` | `umami_cloud` \| `self_hosted` \| `dual` |
| `analytics_default_site_id` | — | Required for `self_hosted` / `dual` |
| `analytics_db_prefix` | `analytics_<slug>` | |
| `analytics_raw_retention_months` | `13` | Rollups are kept forever. |
| `analytics_respect_dnt` | `true` | |
| `analytics_ignore_ips` | — | Comma-separated CIDRs |
| `analytics_geo_source` | `header` | `header` \| `none` |
| `analytics_aggregator_enabled` | `true` | Set `false` on secondary instances. |
| `analytics_persistent_id` | `false` | Opt-in, consent required |
| `analytics_max_scan_days` | `31` | |
| `umami_website_id`, `umami_excluded_paths` | existing | Still used in `umami_cloud` / `dual` |

Per-site settings (domains, timezone, excluded paths, keepQuery, share token, allowedRoles) live in the `site:<id>` doc rather than `_config`. `_config` must stay flat and per-app.

### 4.10 Proposed folder additions

```
layers/analytics/
  app/pages/admin/analytics/…        app/pages/share/analytics/[token].vue
  app/components/admin/…             app/composables/useAnalyticsAdmin.ts
  server/api/analytics/admin/…       server/api/analytics/share/…
  server/routes/a.js.ts              (P2)
  server/plugins/aggregator.ts       server/plugins/init.ts (extend: DB + design docs)
  server/utils/collector/{validate,enrich,ua,geo,referrer,channel,identity,queue}.ts
  server/utils/aggregator/{state,rollup,lease}.ts
  server/utils/query/{rollups,raw-scan,reports/*}.ts
  server/utils/access.ts
  utils/register-layout.ts           (module, mirrors database layer)
  tracker/standalone.ts              (built to /a.js, P2)
```

`composables/` stays where it is to avoid breaking 13 consumers. New client code goes under `app/`, and `imports.dirs` is updated.

## 5. Privacy & security requirements

- Never persist the IP or the raw user agent. Store only parsed fields.
- Never persist a salt for more than 2 days.
- Ingestion:
  - Body size cap, field caps, and rate limit.
  - Hostname must match the site domains on the standalone path.
  - CORS only for the site's domains.
- Admin endpoints return 404 for unauthorized requests, matching `assertAdminSession`.
- Share tokens are random 24-byte values and can be revoked.
- API keys are stored as a sha256 hash and shown only once.
- Remove the `/admin*` and `/login` defaults from tracking in kangu (already done there). Make them a layer default for `self_hosted`.
- Document the GDPR posture in `docs/` (cookieless, no personal data) and the consent requirement for `analytics_persistent_id`.

## 6. Phased plan

Each phase ends with:
- Vitest specs colocated (`*.spec.ts`). Add the `#analytics` alias to `layers/vitest.config.ts` first.
- A Kangu QA pass using the admin password-login flow from the root CLAUDE.md.
- A docs update.
- An `implementation_results` entry.

### P0 — Foundations (storage behind the existing endpoint)
1. Add `analytics_mode` and refactor `stats.post.ts` into the pipeline. Keep `umami_cloud` behaviour byte-identical, and keep the existing specs green.
2. DB provisioning and design docs in `server/plugins/init.ts`. Monthly raw-DB creation, created lazily on first write.
3. Collector: validation, bot/DNT/IP exclusion, UA, geo (header), referrer, UTM, daily salt, visitor hash, batching queue.
4. `site:<id>` doc plus a seed for kangu.
5. **Kangu:** add `../../layers/admin_workspace` to `extends`. Set `analytics_mode=dual` in `cf_env_kangu` to compare against Umami Cloud.

**Exit:** raw events land in `analytics_kangu_raw_2026_10`, and Umami Cloud still receives everything.

### P1 — Fathom Lite parity (MVP)
1. Aggregator: day state, visits, bounce, duration, hour/day rollups, lease, cursor, rebuild endpoint.
2. Query layer for rollups, plus a realtime view.
3. Admin: nav registration, layout module, Overview (KPIs, chart, Pages, Referrers), Realtime, Websites CRUD with the tracking snippet, date ranges, timezone.
4. Access guard (admin only).

**Exit:** kangu's dashboard numbers are within ±5% of Umami Cloud for visitors, pageviews and bounce over 7 days. Expect a documented gap in visitors from daily vs monthly uniqueness.

### P2 — Umami core parity
1. Every dimension: entry/exit, titles, channels, UTM, hosts, browsers, OS, devices, screens, languages, geo with map, tags.
2. Events explorer with property breakdown.
3. Compare periods, combinable filters (raw scan), CSV export.
4. Standalone `/a.js` tracker with Umami-compatible `data-*` attributes, domain allow-list and CORS.
5. Share links, reset data, retention job, IP-exclusion UI, outbound/download auto-capture.

**Exit (validation gate for Q7):**
- 14 days of `dual` mode on kangu with numbers matching Umami Cloud within the P1 tolerance.
- All P2 views working.
- Then switch `cf_env_kangu.analytics_mode=self_hosted`, which stops forwarding to Umami Cloud.

### P3 — Umami reports
1. Goals, funnels, journeys, UTM, attribution, revenue, breakdown/insights.
2. `identify()` and the sessions explorer.
3. Retention, which needs `uid` or the persistent id.
4. Saved segments / cohorts and saved reports.

### P4 — Platform
1. `analytics_viewer` role and per-site `allowedRoles` (teams).
2. API keys and the `/api/analytics/v1` API.
3. Import from Umami (CSV) and Fathom Lite (DB/CSV export).
4. Pixels and tracked links.
5. Rollout guide for moving the other 12 apps from `umami_cloud` → `dual` → `self_hosted`. Each app needs its own explicit go-ahead.
6. Once no app uses `umami_cloud` or `dual`, remove the Umami forwarding code and the `umami_*` keys from the layer.

## 7. Resolved questions

All seven were answered on 2026-10-09 and recorded in §1 (Q1–Q7).
- Q1 accepts that "visitors over a range" is a sum of daily uniques, which differs from Umami's monthly count.
- Q6 means there is no cross-app dashboard: each app's admin reads only `analytics_<slug>*`.

## 8. Implementation notes (deviations from this spec)

- **Raw storage:** month-sharded but *not* CouchDB-partitioned. Ids are `<site>:<ts13>:<rand>`, so every time-range read is an `_all_docs` range, and no design docs or views are needed in any analytics DB.
- **Share page path:** `/admin/analytics/share/:token` instead of `/share/analytics/:token`. It needs no login. The content layer's catch-all only reliably skips its reserved prefixes, and `/admin` is one of them.
- **UA parsing / bot detection:** small in-house parser (`server/engine/ua.ts`) instead of `bowser` + `isbot`. The layer stays dependency-free across its 13 consumers.
- **Geo map:** countries/regions/cities are shown as flag + bar tables. No world-map SVG is shipped.
- **Aggregator memory:** today's events are cached in memory per site, about 0.5 KB each. Realistic v1 ceiling is around 100k–200k events/day per app, below the 1M stated in §4.5.
- **Imports:** Umami event exports become raw events (filterable, reportable). Fathom Lite aggregates become `imp:` day rollups, which dashboards include but filters, reports and the 24 h view don't.
- **Admin opt-in:** pages and nav are registered only when `runtimeConfig.public.analytics.admin.enabled` is true, so the 12 apps that only forward to Umami are untouched.
- **Teams:** implemented as CouchDB roles. `analytics_viewer` (or any role listed in `site.allowedRoles`) can view, and only `admin` can manage.
- **UI i18n:** English only.
- **Single website per app (decided 2026-10-11):** multi-site was dropped. Each app tracks only itself: the website record is auto-created, the Websites page became Settings, website create/delete and `data-website-id` were removed, admin/share APIs use `site/...`, and the v1 API has no site segment. Sections above that describe multiple sites per instance are superseded.

## 9. Risks

- **Rollups:** CouchDB has no ad-hoc aggregation, so filtered queries and reports rely on bounded raw scans. That is why the scan cap and caching exist.
- **Write amplification:** rollups are recomputed every 60 s. Mitigation: write only changed buckets, and use `_bulk_docs`.
- **Aggregator restart cost:** rebuilding today's state scales with the daily volume. That is acceptable at the v1 target.
- **Shared layer:** 13 consumers share the layer, so P0 must not change the default behaviour. Tests must pin the `umami_cloud` path.
