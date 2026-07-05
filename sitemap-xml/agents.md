# Layer: sitemap-xml

Runtime: nuxt 4.x, vue 3.5.x

Generates a `/sitemap.xml` endpoint from the CouchDB content database. Tightly coupled to the `content` and `database` layers — it is intended to be used together with `content`, but `content` can be used without it.

Consumed by: `apps/bitvocation`, `apps/radustanciu` (via `extends` array in their `nuxt.config.ts`).

## Folder map

- `server/api/sitemap.xml.get.ts` — main handler; builds the XML from CouchDB `content/by_path` view + app/runtime config.
- `server/routes/sitemap.xml.ts` — re-export of the handler so the route is also resolvable at `/sitemap.xml` (Nitro route alias).
- `nuxt.config.ts` — registers the `#sitemap-xml` alias to the layer root.
- `package.json` — only declares the `nuxt` peer dependency; no runtime deps.

## Public API / Exports

- HTTP endpoint: `GET /sitemap.xml` (and `GET /api/sitemap.xml`).
- No auto-imported composables, components, or utilities — this is a server-only, side-effect layer.
- Layer alias: `#sitemap-xml` (currently unused by consumers).

## Conventions

- Do NOT add client-side code; the layer is server-only.
- Sitemap entries come from the `content` CouchDB view — do not introduce a second source of truth.
- Origin resolution prefers `runtimeConfig.public.siteUrl` / `siteURL`, then `x-forwarded-*` headers, then `host`. Don't hardcode origins.
- Output is `application/xml; charset=utf-8` with `no-store` cache headers — keep that unless a caching strategy is explicitly added.

## Dependencies

- `#content/server/utils/database` (`getContentDatabaseName`), `#content/utils/page` (`normalizePagePath`), `#content/utils/content-route` (`resolveIgnoredPrefixes`, `isContentRoute`) — from the `content` layer.
- `#database/utils/couchdb` (`getView`) — from the `database` layer.
- Runtime config keys consumed (all optional):
  - `runtimeConfig.public.siteUrl` / `siteURL` (or top-level `siteUrl`)
  - `runtimeConfig.content.sitemap.staticRoutes: string[]`
  - `appConfig.content.sitemapExtraRoutes` (array of strings or `{ path, lastmod }`)
- CouchDB docs: respects `doc.navigation === false` and `doc.meta.sitemap.exclude === true`.

## Build / Test commands

- No standalone lint/typecheck/test setup. The layer has no `package.json` scripts and no `vitest.config.ts`.
- Typecheck/test through a consuming app, e.g. `apps/bitvocation`:
  - `bun run --filter bitvocation typecheck` (or the app's `nuxt typecheck`)
  - `bun run dev` then `curl http://localhost:3000/sitemap.xml` to verify output.

## Gotchas / Pitfalls

- The handler imports directly from `#content` and `#database` — these layers MUST be present in the consuming app's `extends` array, otherwise the build fails at import time.
- `appConfig.content` must be defined (by the `content` layer) for `resolveIgnoredPrefixes` to work; otherwise admin/preview routes may leak into the sitemap.
- Entries are deduped by normalized path; the most recent `updatedAt` wins. Stale CouchDB `updatedAt` strings can shadow newer static routes.
- The route handler sets `no-store` — crawlers will re-fetch on every hit. If you need CDN caching, change the `Cache-Control` headers explicitly.

## Cross-references

- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Related layers: `layers/content`, `layers/database` (not yet documented here).
- No skill directly targets this layer.
