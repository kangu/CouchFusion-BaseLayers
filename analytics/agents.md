# Layer: analytics

Runtime: nuxt 4.x, vue 3.5.x

Reusable Nuxt layer that wires [Umami](https://umami.is)-style analytics into apps: a `useAnalytics()` composable, an auto-loaded tracker via two plugins (client + server), a `v-analytics` directive for declarative event tracking, and a `POST /api/stats` proxy endpoint that forwards to Umami Cloud (or CouchDB-configured host).

Consuming apps (extend this layer):
- `apps/bitvocation`, `apps/couchfusioncom`, `apps/forest-cabin`, `apps/kangu`, `apps/kids-store`, `apps/nuxt-app-starter`, `apps/radustanciu`, `apps/smart-lead`, `apps/testing-1`

## Folder map

- `composables/` — `useAnalytics.ts` (client factory + composable; not under `app/`, registered via `imports.dirs`).
- `plugins/` — `analytics.client.ts` (init client + registers `v-analytics` directive), `analytics.server.ts` (SSR setup), `component-analytics.client.ts` (per-component seen tracking via sessionStorage).
- `server/api/` — `stats.post.ts` (Umami proxy with excluded-path filtering).
- `types/` — `umami.ts`, `umami.d.ts` (directive binding + Umami payload typings).
- `docs/` — Umami integration notes + `implementation_results/`.
- `nuxt.config.ts` — declares `#analytics` alias, `imports.dirs`, the two plugins, and `runtimeConfig.analytics` / `runtimeConfig.public.analytics` defaults.
- `README.md` — full integration walkthrough.

## Public API / Exports

- Composable (auto-imported): `useAnalytics()` → returns the `$analytics` client (or a fresh `createAnalyticsClient()` fallback).
- Factory: `createAnalyticsClient(initialConfig?)` — methods: `init`, `trackPageview`, `trackEvent`, `track`, `trackView`, `trackRouterNavigation`, `isLoaded`, `getInstance`.
- Plugin-injected: `nuxtApp.$analytics` (client-side).
- Directive: `v-analytics` (client only) — binding value is string (event name) or `{ event, data?, trigger? }`; `arg` overrides the trigger (default `click`).
- Server endpoint: `POST /api/stats` — accepts `{ type, payload, sentAt }`; forwards to Umami `proxyHost`.
- Runtime config (public): `runtimeConfig.public.analytics.{endpoint, umami.{websiteId, hostUrl, scriptPath, dataDomains, autoTrack, excludedPaths, includeTitle, sendReferrer, debug, appName, couchEnvSlug}}`.
- Runtime config (private): `runtimeConfig.analytics.umami.{proxyHost, couchEnvSlug}`.

## Conventions

- All layer imports go through the `#analytics` alias.
- Composables live in `composables/` (NOT `app/composables/`) — this layer predates the Nuxt 4 `app/` convention; preserve the existing path or update `imports.dirs` in `nuxt.config.ts` if moving.
- Track via `v-analytics="'event-name'"` in templates; avoid inline `addEventListener` for analytics.
- Excluded paths are configured in `runtimeConfig.public.analytics.umami.excludedPaths` (array or CSV); glob suffix `*` is supported.
- Browser dispatch prefers `navigator.sendBeacon`, then `fetch(..., { keepalive: true })` — do not replace with plain `fetch` without keepalive.
- The `component-analytics.client.ts` plugin dedupes component-view tracking per session via `sessionStorage["component-analytics-seen"]`.

## Dependencies

- Runtime deps assumed from consuming app: `nuxt` (4.x), `vue` (3.5.x). No extra npm packages.
- Optional: reads CouchDB `_config` section `cf_env_[slug]` for `couchEnvSlug`-based host resolution (see root AGENTS.md "Environment Configuration Standard").
- No layer-level `extends`; composes standalone (does not depend on `auth`, `database`, or `content`).
- Forwarding target: Umami Cloud at `runtimeConfig.analytics.umami.proxyHost` (default `https://cloud.umami.is`).

## Build / Test commands

No standalone test config or `package.json` for this layer.

- Lint/typecheck: run inside a consuming app (e.g. `apps/bitvocation`): `bun run lint`, `bun run typecheck`.
- Tests: none at layer scope. Root `layers/vitest.config.ts` covers layers that alias under `#content`/`#database`; analytics has no `#analytics` alias entry there, so add one before writing vitest specs against this layer.
- Smoke test: hit `POST /api/stats` from a running consumer app.

## Gotchas / Pitfalls

- `useAnalytics()` returns a fallback client if `$analytics` is unset on SSR — guard server-side calls or check `import.meta.client`.
- Empty `websiteId` still sends payloads; events will be dropped by Umami. Always set `UMAMI_WEBSITE_ID` in the consumer.
- `excludedPaths` accepts `string | string[]`; misconfiguring as an object silently disables all filtering.
- `v-analytics` is registered only on the client; SSR-rendered bindings are no-ops — do not gate critical UI on directive side effects.
- `analytics.server.ts` may attempt to load the Umami script proxy; ensure `proxyHost` is reachable or events queue silently.
- Two config trees (`runtimeConfig.analytics` vs `runtimeConfig.public.analytics`) — public is for the browser, private for server forwarding. Don't mix them.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `README.md`, `docs/analytics-layer-umami-integration.md`, `docs/umami-config-examples.md`, `docs/umami-excluded-paths.md`, `docs/2025-11-03T15-19-39Z-umami-proxy.md`
- Related skills: `couchfusion-layer-builder`, `vuejs-development`, `vueuse`
