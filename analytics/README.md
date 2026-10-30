# Analytics Layer

Privacy-friendly, self-hosted web analytics for CouchFusion apps. Each app tracks one website: its own. The layer collects pageviews and events from your Nuxt app (or any website), stores them in CouchDB, and gives you an admin dashboard with realtime, reports, sessions, sharing and an API. No cookies, no third-party service, no stored IP addresses.

> A browsable version of this guide with diagrams is in [`README.html`](README.html).

Analytics is on as soon as an app extends the layer. No CouchDB `_config` keys are required: every engine setting has a default.

## Contents

1. [What you get](#what-you-get)
2. [How it works](#how-it-works)
3. [Setup](#setup)
4. [Tracking](#tracking)
5. [The dashboard](#the-dashboard)
6. [Configuration reference](#configuration-reference)
7. [Privacy model](#privacy-model) (and [Country detection](#country-detection))
8. [Sharing, API keys, pixels, links, import](#sharing-api-keys-pixels-links-import)
9. [Operations](#operations)
10. [Troubleshooting](#troubleshooting)
11. [Development and tests](#development-and-tests)

## What you get

- **Dashboard** at `/admin/analytics`: visitors, visits, pageviews, bounce rate, visit duration, events and revenue, with a time chart and period comparison.
- **Breakdowns**: pages, entry/exit pages, titles, hosts, referrers, channels, UTM parameters, countries, regions, cities, languages, browsers, OS, devices, screens, events, event properties and tags. Click any row to filter by it.
- **World map**: a dotted map on the overview with visiting countries highlighted. Hover for numbers, click a continent to zoom in for a more detailed view. When zoomed, click a highlighted country to filter by it, or click elsewhere to zoom out.
- **Realtime**: who is on the site in the last 30 minutes.
- **Reports**: goals, funnels, journeys, retention, UTM, attribution, revenue and multi-dimension breakdowns.
- **Sessions**: every visit with its full event timeline.
- **Sharing and access**: a public read-only link, viewer roles, API keys with a REST API.
- **Extras**: tracking pixels for emails, tracked short links, CSV export, import from Fathom Lite.

## How it works

```
 Browser                      Your Nuxt app (Nitro)                        CouchDB
┌──────────────┐  POST   ┌──────────────────────────────┐  batch   ┌─────────────────────────────┐
│ useAnalytics │ ──────► │ /api/stats                   │ ───────► │ analytics_<slug>_raw_YYYY_MM │
│ v-analytics  │  hits   │  validate → bot/DNT/IP rules │  writes  │   one doc per hit            │
│ /a.js script │         │  enrich (UA, geo, referrer)  │          └──────────────┬──────────────┘
└──────────────┘         │  hash visitor (daily salt)   │                         │ every 60 s
                         └──────────────────────────────┘                         ▼
                         ┌──────────────────────────────┐          ┌─────────────────────────────┐
 Admin dashboard  ◄───── │ /api/analytics/admin/**      │ ◄─────── │ analytics_<slug>             │
 /admin/analytics  JSON  │  rollups for totals/tables   │  reads   │   day rollups, sites, salts, │
                         │  raw scans for filters,      │          │   segments, keys, pixels…    │
                         │  reports, sessions, realtime │          └─────────────────────────────┘
                         └──────────────────────────────┘
```

1. **Collect.** The browser sends each pageview and event to `POST /api/stats`.
2. **Filter and enrich.** The server drops bots, Do-Not-Track visitors, ignored IPs and excluded paths. It then works out browser, OS, device, country (from CDN headers), referrer, channel and UTM parameters.
3. **Anonymise.** The visitor is identified by a hash of a daily random salt, the site, the IP and the user agent. The IP and user agent are never stored.
4. **Store.** Hits are written in batches to a raw-event database, one database per month.
5. **Aggregate.** Every 60 seconds a background job turns raw hits into one rollup document per site per day.
6. **Query.** The dashboard reads rollups for unfiltered views, which is fast. Filters, reports, sessions and realtime read the raw hits, limited to 31 days by default.

## Setup

Collection needs only step 1. Steps 2–5 set up the admin dashboard.

### 1. Add the layers

```ts
// apps/<app>/nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    "../../layers/database",
    "../../layers/auth",
    "../../layers/analytics",
    "../../layers/admin_workspace", // admin layout + sidebar
  ],
  runtimeConfig: {
    public: {
      appSlug: "my-app", // selects the CouchDB section cf_env_my-app
      analytics: {
        admin: { enabled: true }, // registers /admin/analytics/** and the sidebar section
      },
    },
  },
});
```

### 2. Install the dashboard packages in the app

```bash
bun add apexcharts @iconify/vue
```

### 3. Let Tailwind see the admin layout (Tailwind v4 apps)

```css
/* app/assets/css/main.css */
@source "../../../../../layers/admin_workspace/**/*.{vue,ts}";
@source "../../../../../layers/auth/app/**/*.{vue,ts}";
```

On first start the server creates the app's analytics databases and its website record by itself, named after the app slug. The startup log prints both.

### 4. Review the website settings

Log in with a user that has the `admin` role and open `/admin/analytics/settings`:

1. Set the display name and the timezone (it defines where a day starts and ends).
2. List the site's domains, one per line (subdomains are included). While the list is empty, hits from any hostname are accepted.
3. Keep `/admin*` and `/login` in **Excluded paths** so your own admin work isn't counted.

### 5. Check it

Open a public page of the site, then look at **Realtime**. The hit appears immediately. Overview totals follow within about a minute.

If the app has no `/admin` page yet, add one that uses the `admin-workspace` layout (see `apps/kangu/app/pages/admin/index.vue`).

## Tracking

### Automatic

Once the layer is extended, every route change in the Nuxt app is tracked as a pageview. Nothing else is needed. Failed, aborted and duplicate navigations aren't counted, and neither are hash-only changes (`/page#a` → `/page#b`) unless `trackHashChanges` is on. Query changes such as pagination still count. Each pageview is sent once the new page's title is set, so the Titles report shows the right page.

### Custom events

```vue
<script setup lang="ts">
const analytics = useAnalytics();

const onSignup = () => analytics.trackEvent("signup", { plan: "pro" });
</script>

<template>
  <button v-analytics="'cta-click'">Start</button>
  <button v-analytics="{ event: 'cta-click', data: { location: 'hero' } }">Try it</button>
  <a v-analytics:mouseover="'pricing-hover'" href="/pricing">Pricing</a>
</template>
```

Event data must be flat: up to 20 properties, values up to 200 characters.

### Revenue

Send an event with `revenue` (number) and `currency` (ISO code):

```ts
analytics.trackEvent("purchase", { revenue: 49, currency: "EUR", plan: "pro" });
```

### Identifying logged-in users

```ts
analytics.identify(user.id, { plan: "pro" });
```

Later hits carry that id. Retention and multi-day attribution need this, because anonymous visitors get a new hash every day.

### Composable API

| Method | Purpose |
|---|---|
| `trackEvent(name, data?, extra?)` / `track(...)` | custom event |
| `trackPageview(extra?)` / `trackView(url?, referrer?)` | manual pageview |
| `identify(id?, data?)` | attach an app user id and session properties |
| `trackRouterNavigation(to, from)` | used by the router hook |

### Optional client settings (`runtimeConfig.public.analytics`)

| Key | Default | Purpose |
|---|---|---|
| `admin.enabled` | `false` | register the admin pages and sidebar section |
| `autoCapture.outbound` | `false` | send `outbound-link-click` for links to other hosts |
| `autoCapture.downloads` | `false` | send `file-download` for links to files |
| `autoCapture.downloadExtensions` | pdf, zip, csv, … | comma-separated list of extensions |
| `persistentId` | `false` | opt-in localStorage visitor id (needs consent, and `analytics_persistent_id=true` on the server) |
| `tag` | — | tag attached to every hit, for A/B variants or deploys |
| `includeTitle`, `sendReferrer`, `debug` | `true`, `true`, `false` | payload details |
| `trackHashChanges` | `false` | count hash-only route changes as pageviews |
| `endpoint` | `/api/stats` | where the client posts hits |

### Pages outside the Nuxt app

If part of the website is served elsewhere (a static landing page, a docs site on a subdomain), list that domain under Settings → Domains and add:

```html
<script defer src="https://your-app.example/a.js"></script>
```

No website id is needed: every hit goes to the app's one website.

Supported attributes: `data-auto-track="false"`, `data-domains`, `data-tag`, `data-exclude-search`, `data-exclude-hash`, `data-do-not-track`, `data-before-send`, `data-host-url`.

In page scripts: `cfa.track("event", { key: "value" })` and `cfa.identify("user-id")`. In HTML: `<a data-cfa-event="cta" data-cfa-event-plan="pro">`.

## The dashboard

| Page | Path | Who |
|---|---|---|
| Overview | `/admin/analytics` | admin, viewers |
| Realtime | `/admin/analytics/realtime` | admin, viewers |
| Events | `/admin/analytics/events` | admin, viewers |
| Sessions | `/admin/analytics/sessions` | admin, viewers |
| Reports | `/admin/analytics/reports` | admin, viewers |
| Settings | `/admin/analytics/settings` | admin |
| Pixels, links & import | `/admin/analytics/tools` | admin |
| API keys | `/admin/analytics/api-keys` | admin |
| Shared dashboard | `/admin/analytics/share/<token>` | anyone with the link |

**Roles.** Users with the CouchDB role `admin` see and manage everything. To give someone read-only access, give them the `analytics_viewer` role and add that role under **Settings → Viewer roles**.

**Filters.** Click a row in any table to filter by it. Filters combine, live in the URL, and can be saved as segments.

**Theme.** The dashboard follows the admin workspace and is light by default. It turns dark only when a parent element has a `dark` class or `data-theme="dark"`.

## Configuration reference

All keys are optional. They live in CouchDB `_config`, section `cf_env_<appSlug>`, as flat strings. Most can be edited under **Settings → Engine**. Changes apply within about a minute, with no restart.

| Key | Default | Meaning |
|---|---|---|
| `analytics_default_site_id` | app slug | id of the app's website record; rarely needs setting |
| `analytics_db_prefix` | `analytics_<slug>` | database name prefix |
| `analytics_raw_retention_months` | `13` | raw hits older than this are deleted; rollups are kept |
| `analytics_respect_dnt` | `true` | drop hits with `DNT: 1` or `Sec-GPC: 1` |
| `analytics_ignore_ips` | — | comma-separated IPs or CIDRs to ignore |
| `analytics_trust_headers` | `auto` | `auto`: trust Cloudflare's IP and geo headers only on requests that came from a Cloudflare address. `cloudflare`: always trust them. `all`: trust every forwarding header as sent (old behavior). See [Country detection](#country-detection). |
| `analytics_geo_source` | `auto` | `auto`: CDN header, otherwise the browser time zone. `header`: CDN headers only. `timezone`: time zone only. `none`: no geo. |
| `analytics_aggregator_enabled` | `true` | set `false` on instances that shouldn't aggregate |
| `analytics_persistent_id` | `false` | accept the opt-in persistent visitor id |
| `analytics_max_scan_days` | `31` | longest range for filters, reports and sessions |

Website settings (name, domains, timezone, excluded paths, goals, viewer roles, share link) are edited on the **Settings** page.

## Country detection

Country comes from one of two places, chosen by `analytics_geo_source` (default `auto`: the header when there is one, otherwise the time zone). No IP database is installed, nothing is looked up remotely, and the IP is not stored.

1. **A CDN header** (country, plus region and city when the CDN sends them). See the list below.
2. **The browser's time zone**, for sites with no CDN header. The trackers send the visitor's IANA time zone (for example `Europe/Bucharest`), and the server maps it to a country with a built-in table generated from the public-domain tz database (`server/engine/tz-country.ts`, about 10 KB, 541 zone names, 247 countries).
   - It gives a country only, never a region or city.
   - Zones with no country (`UTC`, `Etc/*`) give no country. So does `Atlantic/Reykjavik`, which Firefox's fingerprinting protection, Tor Browser and Mullvad Browser report for everyone.
   - It's wrong for people whose computer is set to a different country's time zone (travelers who changed it, remote desktops). It's right for VPN users, unlike IP-based lookup.
   - To refresh the table (once or twice a year is plenty), run `node scripts/generate-tz-country.mjs`.

Header sources:

- **Cloudflare** sends `CF-IPCountry` when the site is proxied (orange cloud) and *Network → IP Geolocation* is on, which is the default. For region and city, enable the managed transform *Add visitor location headers*.
- **A reverse proxy between Cloudflare and the app** (Caddy, nginx) is fine as long as it forwards request headers. Caddy's `reverse_proxy` does this by default; don't strip `CF-IPCountry` or `CF-Connecting-IP` with `header_up -...`.
- CloudFront (`CloudFront-Viewer-Country`) and Vercel (`X-Vercel-IP-Country`) headers are read too.
- **Check it:** Settings → Engine shows how many hits since the last server start carried a country, and how many of those came from the time zone.
- Local development has no CDN in front, so with `auto` the country comes from your own time zone.

**Which headers are trusted** (`analytics_trust_headers`, default `auto`). Visitors can send any header, so with `auto` the layer checks who actually connected:
- **The connecting address.** This is the socket peer. When the peer is a local reverse proxy (a loopback or private address, e.g. Caddy on 127.0.0.1), it is instead the address that proxy reports in `X-Real-IP`, or the last `X-Forwarded-For` hop. Your Caddy template sets `X-Real-IP {remote_host}`.
- **Cloudflare's headers** (`CF-Connecting-IP`, `CF-IPCountry`, region, city) are used only when that address is one of Cloudflare's published ranges. Anyone else sending them is ignored, so on sites not behind Cloudflare, visitors can't choose their IP (which feeds the visitor hash, ignored IPs and rate limiting) or their country.
- **Other CDN headers** (CloudFront, Vercel, `X-Country-Code`) are ignored with `auto`.

Set `cloudflare` when another proxy or load balancer sits between Cloudflare and Caddy, so Caddy sees that proxy's address instead of Cloudflare's. Set `all` for the old behavior (every header trusted as sent), e.g. on CloudFront or Vercel, or when your own proxy sets `X-Country-Code`. Settings → Engine shows how many hits carried Cloudflare headers that were ignored.

Cloudflare's ranges are built into `server/engine/net.ts`. Check them against https://www.cloudflare.com/ips/ now and then; they rarely change.

## Privacy model

- **No cookies and no local storage** by default.
- **Visitor id** = `sha256(daily salt | site | IP | user agent)`, shortened to 64 bits. The salt is random, changes every day in the site's timezone, and is deleted after two days. After that the hash can't be linked back to anyone.
- **Never stored:** IP address, full user agent, query strings (except UTM parameters, unless you enable "Keep query strings").
- **Stored per hit:** path, title, host, referrer domain and path, channel, UTM values, browser, OS, device type, screen size, language, country, region and city when the CDN provides them, event name and properties.
- **Unique visitors are per day.** A range total is the sum of daily uniques, like Fathom and Plausible. Someone who visits on three days counts three times.
- **Bots** are dropped on the server: crawlers, link previewers, headless browsers and scripts.

## Sharing, API keys, pixels, links, import

- **Share link.** Settings → Public share link. Anyone with the link gets a read-only dashboard. Rotate or revoke it at any time.
- **API keys.** API keys page. The key is shown once. Use it as a bearer token:

  ```bash
  curl -H "Authorization: Bearer cfa_…" \
    "https://your-app.example/api/analytics/v1/stats?range=30d&compare=1"
  ```

  Endpoints: `GET /v1/site`, `GET /v1/stats`, `GET /v1/metrics/:dimension`, `GET /v1/realtime`, `GET /v1/sessions`, `POST /v1/reports/:type`.
  Query: `range` (`today`, `yesterday`, `24h`, `7d`, `30d`, `90d`, `12m`, `this_month`, `last_month`, `this_year`) or `from`/`to` (`YYYY-MM-DD`), `filters` (JSON array of `{ dim, op, value }`), `limit`, `offset`.
- **Tracking pixels.** Tools page. Put the image in an email or external page; each load is a `pixel-view` event.
- **Tracked links.** Tools page. `/l/<slug>` records a `link-click` event and redirects.
- **CSV export.** The CSV link on each dashboard table.
- **Import.** Tools page. Upload Fathom Lite's hourly `site_stats`, `page_stats` and `referrer_stats` CSVs. They appear in dashboards but not in filtered views or reports.

## Operations

**Databases** (readable by CouchDB admins only):

| Database | Contents |
|---|---|
| `analytics_<slug>` | the website record, day rollups, salts, segments, saved reports, API keys, pixels, links, aggregator lease |
| `analytics_<slug>_raw_<yyyy>_<mm>` | raw hits for that month |

- **Aggregator.** Runs inside the app every 60 seconds. With several instances, a lease in CouchDB makes sure only one aggregates. An instance that is killed hard can hold the lease for up to three minutes.
- **Retention.** Whole monthly raw databases are dropped once they are older than `analytics_raw_retention_months`.
- **Rebuild.** Settings → Data → Rebuild recomputes rollups for a date range from raw hits. Days whose raw hits were already deleted by retention keep their rollups, and the result says how many were skipped.
- **Reset.** Settings → Data deletes all collected data after you type the website id. It deletes in pages, reports an error if anything couldn't be deleted (running it again is safe), and tells every instance to drop its in-memory copy of today.
- **CouchDB outages.** Hits are buffered in memory (up to 20,000) and retried with backoff, from 2 up to 30 seconds. They are written once CouchDB answers again. Every CouchDB call times out (15 s, or 60 s for scans and bulk writes), so a stalled CouchDB never hangs requests. If `_config` can't be read, the last settings that loaded stay in use. If none have loaded since the server started, nothing is stored or deleted until they can be read. Settings → Engine shows both states.
- **Request size.** `/api/stats` accepts bodies up to 32 KB and the APIs up to 64 KB (the import, 50 MB). Larger requests get 413 before they are fully read.
- **Capacity.** Today's hits are kept in memory for aggregation. Plan for roughly 100–200k hits per day per app.
- **Backups.** Back up `analytics_<slug>`. Raw month databases can be replicated like any CouchDB database.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| My own visits don't show | You only visited `/admin*` or `/login`, which are excluded. Open a public page. |
| Hits appear in Realtime but not in Overview | Rollups refresh every 60 seconds. |
| Nothing is recorded at all | CouchDB isn't reachable, or its `_config` can't be read (the log says "could not read _config … collection is paused"), or "Collecting" is switched off in Settings. |
| A browser never shows up | It sends Do-Not-Track or Global Privacy Control (Brave does by default), or its IP is in `analytics_ignore_ips`. Settings → Engine lists how many hits were dropped and why since the server started. |
| Hits from another domain are dropped | The domain isn't listed under Settings → Domains. |
| No countries | `analytics_geo_source` is `header` and the app isn't behind a CDN that sends country headers. Use `auto`. See [Country detection](#country-detection). |
| Automated tests aren't counted | Headless browsers are treated as bots. |
| "Filtered queries are limited to 31 days" | Raise `analytics_max_scan_days`, or remove the filter. |
| `/admin` shows "Page not found" | The app has no `/admin` page. Add one with the `admin-workspace` layout. |
| Admin sidebar is unstyled | Tailwind isn't scanning `layers/admin_workspace`. See setup step 3. |

## Development and tests

```bash
cd layers
npx vitest run --config vitest.config.ts analytics
```

Integration test against a real CouchDB (uses a throwaway database prefix and cleans up):

```bash
ANALYTICS_IT=1 COUCHDB_ADMIN_AUTH=<base64 user:pass> npx vitest run --config vitest.config.ts analytics/server/engine/integration
```

Code map:

| Path | What |
|---|---|
| `composables/`, `plugins/` | browser tracker, `v-analytics`, auto-capture |
| `server/api/stats.post.ts` | ingestion endpoint |
| `server/engine/` | collector, rollups, aggregator, queries, reports, imports, access control |
| `server/api/analytics/**`, `server/routes/` | admin, share and v1 APIs; `/a.js`; `/l/:slug`; pixel |
| `admin/` | dashboard pages and components |
| `modules/admin.ts` | registers pages and sidebar when enabled |
| `scripts/generate-world-dots.mjs` | regenerates the map's dot grid (`admin/utils/world-dots.ts`) from Natural Earth data |

More detail: [`docs/self-hosted-analytics.md`](docs/self-hosted-analytics.md) and the design spec in `docs/specs/`.
