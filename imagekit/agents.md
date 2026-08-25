# Layer: imagekit

`Runtime: nuxt 4.1.x, vue 3.5.x`

ImageKit CDN integration layer for CouchFusion apps. Provides an `imagekit` server service (upload/list/delete/generate-url), a `useImageKit` composable, `v-imagekit` / `v-lazy` / `v-lazy-background` directives, transform-URL sanitization helpers, and an admin file browser endpoint. Consumed by: bitvocation, couchfusioncom, forest-cabin, indux, kangu, kids-store, nuxt-app-starter, pacanele-dashboard, ping-pong-events, radustanciu, smart-lead.

## Folder map

- `composables/useImageKit.ts` — auto-imported client composable.
- `utils/imagekit.ts` — `ImageKitService`, `getImageKitService`, types, and upload/list/auth helpers.
- `utils/transform.ts` — transform URL parsing/whitelist/sanitization/merge helpers.
- `plugins/imagekit-directive.ts` — `v-imagekit` directive (transforms `<img src>`).
- `plugins/lazy.ts` — `v-lazy` directive (lazy-load `<img>`).
- `plugins/lazy-background.ts` — `v-lazy-background` directive.
- `server/api/imagekit/` — `files.get.ts`, `files/[fileId].delete.ts`, `upload.post.ts`, `generate-url.post.ts`, `files/` (browse).
- `server/plugins/init.ts` — boots server imagekit SDK config.
- `server/utils/assert-imagekit-session.ts` — admin/curator/organizer session guard.
- `docs/` — many dated implementation notes + reference docs (`layer_spec.md`, `imagekit-img-directive.md`, `img_tag_helper.md`, etc.).
- `server/utils/imagekit-config.ts` — CouchDB-backed ImageKit configuration loaded once during Nitro startup.
- `server/api/imagekit/runtime-config.get.ts` — exposes only public ImageKit configuration to client consumers.
- `nuxt.config.ts` — `#imagekit` alias and the registered composables, utilities, and directive plugins.

## Public API / Exports

- Alias: `#imagekit` — e.g. `#imagekit/utils/imagekit`, `#imagekit/utils/transform`.
- Auto-imported composable: `useImageKit()` → `UseImageKit`.
- Auto-imported utilities include `getImageKitService`, `IMAGEKIT_TRANSFORM_PREFIX_WHITELIST`, `normalizeTransformInput`, `splitImageKitTransformations`, `sanitizeImageKitTransformations`, `mergeImageKitTransformations`, `extractImageKitTransformations`, `withImageKitTransformations`, and `resolveImageKitUrl`, plus their ImageKit types.
- Directives: `v-imagekit`, `v-lazy`, `v-lazy-background`.
- Server endpoints under `/api/imagekit/*` (`upload`, `generate-url`, `files`, `files/[fileId]`).
- Session guard: `assertImagekitSession` (server util, auto-imported in Nitro) — returns `AssertedImagekitSession`.
- `useImageKitPublicConfig()` loads the public endpoint, key, and optional folder from `/api/imagekit/runtime-config`; private credentials never leave the server.

## Conventions

- Use `#imagekit` alias for cross-file imports.
- Transformations are sanitized against `IMAGEKIT_TRANSFORM_PREFIX_WHITELIST`; never pass raw user transform strings to ImageKit URLs — use `sanitizeImageKitTransformations` / `withImageKitTransformations`.
- Directives expect an ImageKit-hosted `src` (or any URL resolvable via `resolveImageKitUrl`); external URLs pass through unchanged.
- CouchDB environment section: `cf_env_[appSlug]`, with `imagekit_public_key`, `imagekit_private_key`, `imagekit_url_endpoint`, and optional `imagekit_folder`.
- Admin file operations require `assertImagekitSession` (roles: admin / curator / organizer — see `2026-03-24T07-02-33Z` doc).
- Keep spec/notes in `docs/` with the dated naming convention.

## Dependencies

- Bundled dep: `imagekit` (`6.0.0`) — the official Node SDK.
- Depends on `layers/auth` for session guard (`#auth/server/utils/authenticated-user` in `server/utils/assert-imagekit-session.ts`).
- Transitively depends on `layers/database` via `#auth`.
- Consuming app must set `runtimeConfig.public.appSlug` and configure the ImageKit keys in that app's CouchDB environment section before startup.

## Build / Test commands

- No standalone lint/typecheck/test script in `package.json` (no `scripts` block).
- Tests, if any, run via `layers/vitest.config.ts` from repo root: `npx vitest run layers/imagekit`.
- Lint/typecheck via a consuming app (e.g. `apps/bitvocation`): `bun run lint`, `bun run typecheck`.

## Gotchas / Pitfalls

- ImageKit configuration is fetched once by the Nitro startup plugin and cached for the process lifetime. Request handlers never query CouchDB for ImageKit credentials.
- `getImageKitService()` creates its SDK client from that startup cache; the private key is never returned by the public configuration endpoint.
- Directive plugins mutate `<img>` attributes; SSR renders transformed URLs — verify hydration doesn't double-apply (see `2026-03-03T06-51-58Z` doc).
- Transform whitelist additions require updating `IMAGEKIT_TRANSFORM_PREFIX_WHITELIST` and re-testing merge logic (see `2026-03-03T06-17-52Z`, `...add-z` docs).
- `v-lazy` and `v-lazy-background` use IntersectionObserver; provide a fallback `src` for SSR/no-JS.
- Browse dialog expects paginated list (see `imagekit-library-pagination.md`); large folders need pagination params.

## Cross-references

- Root conventions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/` (esp. `layer_spec.md`, `imagekit-img-directive.md`, `img_tag_helper.md`)
- Depends on: `layers/auth` (and transitively `layers/database`)
- Related skills: `imagekit-upload`, `couchfusion-layer-builder`
- Consumers: see list above under `apps/*/nuxt.config.ts`
