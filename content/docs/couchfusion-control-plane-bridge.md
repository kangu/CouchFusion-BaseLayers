# CouchFusion control-plane bridge (dev sessions)

The CouchFusion control plane (Rust server on the VPS, `cli-init/server`) runs an app's `nuxt dev` in a sandboxed systemd unit and shows the builder full screen inside its own web UI. This layer provides the dev-server side of that integration:

- **token-gated control routes** the control plane calls over loopback (readiness, component usage, and the LLM-request page operations);
- a **postMessage bridge** so the builder (child, in the iframe) can ask the control plane (parent) to delete or create content components and can be reloaded by it;
- host-only buttons in the component picker.

Contract: `cli-init/docs/superpowers/specs/2026-10-29-phase1-mvp-contract.md` (§5–§7). Parent design: `2026-10-29-rust-vps-control-plane-design.md` (§5.4–§5.5, §6).

## Gating — inert everywhere else

Every piece is off unless the supervisor started the dev server for this purpose. Apps that share this layer, production builds, and normal local `bun run dev` see no change.

| Piece | Active only when |
|---|---|
| Control routes `/__couchfusion/control/*` | `nuxt.options.dev` **and** `COUCHFUSION_CONTROL_TOKEN` is non-empty (module `utils/register-control-plane-routes.ts`). Without the header token every request gets **404**. |
| `vite.server.allowedHosts += <slot hostname>` | dev **and** `COUCHFUSION_PUBLIC_ORIGIN` is a valid http(s) URL. Never overrides `allowedHosts: true`. |
| Bridge (`useControlPlaneBridge`) | client **and** `import.meta.dev` **and** `runtimeConfig.public.content.controlPlane.origins` non-empty **and** the page is framed or has `window.opener`. It is started only by the builder (`InlineLiveEditor`), never by public pages or the nested inline preview. |
| Picker buttons ("New component", per-card "delete file") | the bridge received the parent's `welcome` (`connected === true`). |

Verified against `apps/radustanciu` by loading its Nuxt config: no env → no routes; production build with the vars set → no routes; dev with the token → exactly the control routes (two in Phase 1; six since the LLM request routes, 2026-11-02).

## Environment (injected by the control plane)

Written by the control plane to `/run/couchfusion/dev/<app>.env` before it starts `cf-dev@<app>`:

| Variable | Purpose |
|---|---|
| `COUCHFUSION_CONTROL_TOKEN` | Per-start secret; required in header `x-couchfusion-control-token` on the control routes. |
| `COUCHFUSION_PUBLIC_ORIGIN` | The dev slot origin the browser uses, e.g. `https://hetzner1.tailb7471b.ts.net:9181`. Only its hostname is used (Vite `allowedHosts`). |
| `NUXT_PUBLIC_CONTENT_CONTROL_PLANE_ORIGINS` | Comma-separated control-plane origins the bridge may talk to (fills `runtimeConfig.public.content.controlPlane.origins`). |
| `COUCHFUSION_AGENT_MARKER` | Path of the marker file that exists while a Codex generate job runs (`/run/couchfusion/dev/<app>.agent-running`). Enables the agent reload guard (below). |

**Why these are not `cf_env_[slug]` parameters.** The repo rule says layers read app environment parameters from CouchDB `_config` (`cf_env_<slug>`). These values are different in kind: they are per-process supervisor injections that change on every dev start (the token), describe how this particular process is reached (the slot origin), and must never exist in production. Storing them in `_config` would make them shared, persistent and visible to production — the opposite of what they are for. They follow the same pattern as the existing `COUCHFUSION_PREVIEW` / `COUCHFUSION_PREVIEW_TOKEN` preview-host variables. Application parameters (ImageKit, analytics, …) still come from `cf_env_<slug>`.

## Control routes

Registered as Nitro handlers from `runtime/control-plane/` (`CONTROL_PLANE_ROUTES` in `utils/register-control-plane-routes.ts`, each entry with its `method`):

| Route | Response |
|---|---|
| `GET /__couchfusion/control/ping` | `{"ready": true}` — readiness probe used instead of scraping logs. |
| `GET /__couchfusion/control/component-usage?id=<kebab-id>` | `{"pages": [{"id","path","title"}], "scanned": <n>}` — pages that reference the component. `400` for an invalid id. |
| `GET /__couchfusion/control/pages` | `{defaultLocale, locales, pages: [{path, title, publicationState, locales, redirect: {to, status}\|null, updatedAt}]}` — current pages, one per base path, sorted. |
| `GET /__couchfusion/control/page-documents?path=/a&path=/b` or `?all=1` | `{pages: [{path, documents: [{locale, id, rev, title, seo: {title, description, image}, publicationState, layout, body}]}]}`. Unknown paths answer `documents: []`; no `path`/`all` → `400`. |
| `POST /__couchfusion/control/pages/check` | `{ok, problems: [{index, message}], preview: [{index, op, path, locales, changes: [{field, before, after}]}]}` — validates, never writes. |
| `POST /__couchfusion/control/pages/apply` | `{ok: true, applied: [{index, path, documents: [{id, rev}]}]}`; `409 {ok: false, problems}` (nothing written); `500 {ok: false, applied, failed: {index, message}}`. |

The token is checked before anything else (also before the request body is read). The comparison is constant time (`runtime/control-plane/token.ts`). Responses are `Cache-Control: no-store`. Contract for the page routes: `cli-init/docs/superpowers/specs/2026-11-02-llm-request-contract.md`.

### Usage scan

`server/utils/component-usage.ts` (`findComponentPageUsage`) walks every `page-*` document's `body.value` minimark tree and matches component tags against the registry id (`network-hero`) and its PascalCase alias (`NetworkHero`), at any depth. Locale variants are separate full documents (`page-<path>::<locale>`) in the same key range, so all locales are covered. `oldpage-*` history is skipped. Bare text nodes do not count.

`server/utils/global-component-usage.ts` now delegates to the same walker with `matchTextNodes: true`, which preserves its historical behaviour exactly (it used to count a text node equal to the alias).

The scan is advisory: references from global-component definitions, design documents or translations are not covered. The control plane also scans code references and soft-deletes into trash.

## Page operations (LLM request)

Codex runs sandboxed without database access, so it *proposes* page operations; the control plane reads page context through `pages` / `page-documents`, validates the proposal with `check`, shows the preview, and on Apply calls `apply`. Dev and production share CouchDB, so an applied change is live immediately. Logic: `server/utils/control-page-operations.ts`; the handlers are thin.

**Operations** (`{operations: Operation[], baseRevs: {docId: rev}}`, at most 50):

| `op` | Fields | Written with |
|---|---|---|
| `page.create` | `path`, `title`, `body` (required); `seo?`, `layout?`, `publicationState?` (`published` \| `draft`, **default `draft`**) | `saveLocalizedPageDocument(…, {isCreate: true})` for the default locale — the same path as `POST /api/content/pages` (builder create), so the document shape matches and page history is saved. Translations: a later `page.update` with `locale`. |
| `page.update` | `path`, `locale?` (default locale when omitted), at least one of `title`, `seo` (partial: `title`, `description`, `image` — `null` clears the image), `body` (`{type: "minimal", value}`), `layout` | `saveLocalizedPageDocument` (builder save of that locale; page history saved). A locale without a document gets a new translation, as in the builder. |
| `page.move` | `from`, `to`, `keepRedirect` (boolean, required) | `renameContentPageUrl` (all locales) |
| `page.copyContent` | `from`, `to` | `saveLocalizedPageDocument` per locale document of `to`, default locale first; body and layout from the same locale of `from`, else its default locale. `to` keeps URL, title, SEO, state. When `from` has fixed body paths they are carried along (they are pointers into the copied body). |
| `page.publication` | `path`, `state` (`published` \| `draft`) | `setContentPagePublicationState` (`server/utils/content-page-publication.ts`, extracted from `PATCH /api/content/pages/publication-state`, which now calls it) |

**Check.** Operations are validated in order against a simulated state, so `page.update` on the target of an earlier `page.move` works and a later operation's preview "before" is the earlier operation's "after". A `page.create` path is "occupied" when a page exists there, an earlier operation of the same proposal created or moved a page there, or any document id of that path exists (same rule as a move target); later operations may update or publish the new page. Problems: unknown op or field, `page.create` without `title`/`body` or on an occupied, locale-prefixed, reserved or asset path, invalid/missing fields, a path with a locale prefix (`/ro/x` → use `/x` + `locale`), page not found, move target exists, moving the home page or to a reserved/asset path, redirect page as move or copy source, copy into a redirect page or update of a redirect page (its content is never shown), body over 1 MB or not a valid minimark tree, unknown component tags, and `baseRevs` mismatches (`Page /x (en) changed since the request ran.`). Rev check covers the documents an operation may write: the locale document (plus every locale when a body is written, since fixed body paths propagate; plus the master for a new translation), all source/target documents of a move, and both pages of a copy.

**Known components** (`page.update` and `page.create` bodies): HTML/SVG tags from the runtime renderer's `HTML_TAGS` (case-insensitive, as `Content.vue` does) and the primitives `p`, `span`, `strong`, `template`; the app's registry ids from `<srcDir>/content-builder/component-definitions.json` (written by `content-registry` next to the `.ts` registry) with their PascalCase and camelCase aliases; enabled global component aliases from `content-settings:global-components` (exact id). The module puts the manifest locations into `runtimeConfig.content.controlPlaneRegistryManifests` (`<srcDir>/content-builder`, `<rootDir>/app/content-builder`, `<rootDir>/content-builder`); the dev server's cwd is a fallback. The manifest is re-read on every check, so components Codex just created count once the registry has settled. Only tags **introduced** by the operation are validated — tags already present in that document's current body are tolerated, so a page that still references a removed component can be edited. A created page has no current body, so every non-HTML tag must be known. Without a readable manifest every introduced non-HTML tag is a problem (fail closed).

**Preview** strings are at most 200 characters: titles and SEO fields as text (`(none)` for empty), `publicationState`, `path`/`redirect` for a move, `layout` as compact JSON, and bodies as an outline `5 blocks: HeroBanner, TextBlock, …` (`(content changed)` when only props/text changed) plus `body.components` = `removed: …` / `added: …` (alias-insensitive). Copy previews name the locale (`body (ro)`) when the target has several. Move and copy entries also carry `from` and `to`. A `page.create` preview lists `path`, `title`, `seo.title`, `seo.description`, `seo.image` (the values the save will store, e.g. `seo.title` falls back to the title and `seo.description` to `SEO description.`), `publicationState`, `body` (outline) and `layout` when given, all with `before: null`.

**Apply.** Re-runs `check` (any problem → `409`, nothing written). Then, per operation: re-read the involved documents and require the revs `check` saw (or the earlier operation wrote) — a concurrent edit stops the run with `500 … failed`; write with the helper; re-read and report every document whose rev changed (`{id, rev}`, plus `deleted: true` for a move without redirect). `applied[].path` is the written path (`to` for move/copy). `page.create` has no `baseRevs` entry; a page that appeared since the request makes `check` (and so `apply`) answer 409, and one that appears between check and write is caught by the per-operation rev guard (`500 … failed`, nothing written for that operation); `isCreate: true` refuses an existing page as a last line.

## Bridge protocol (child side)

`app/composables/useControlPlaneBridge.ts`. Envelope `{cf: 1, type, id, nonce?, replyTo?, payload}`; all types start with `cf:host.` so they never collide with the inline-preview messages.

1. On mount the builder calls `start({builder: true})`. The child posts `cf:host.ready {app, route, builder, dirty}` to `window.parent` (or `window.opener`), once per configured origin as `targetOrigin`, so only a parent at an allowed origin can read it. It retries every second up to 10 times until `welcome`.
2. It accepts `cf:host.welcome {nonce, capabilities}` only from the target window and an allowed origin, then **pins** that origin and nonce. Every later message must match both.
3. Requests: `requestDelete(componentId)` → `cf:host.component.delete.request`; `requestCreate(promptHint?)` → `cf:host.component.create.request` (hint truncated to 2 KB). Each resolves with the parent's `cf:host.request.result {status, message?, componentId?}` or `failed` after 120 s. **Requests are never authority**: the parent confirms in its own UI and calls its own API.
4. `cf:host.reload.request` → the registered handler decides. `InlineLiveEditor` reloads immediately when clean; with unsaved changes it asks first and, on confirm, removes its `beforeunload` guard so the browser does not prompt twice. It answers `cf:host.reload.ack {reloading}` (`reason: "unsaved"` when deferred).
5. `setDirty()` is driven by the editor's unsaved state and sent as `cf:host.dirty`.
6. `cf:host.component.focus {componentId}` (sent after a create-triggered reload) sets `focusComponentId`. The Workbench opens the root picker, and the picker switches to "All", clears the search, scrolls the card into view and highlights it for 4 s.

## Picker UI

`app/components/builder/ComponentPickerDialog.vue`:

- **New component** button in the header controls. It sends the current search text as the prompt hint.
- **Delete component file** trash button per card, reusing the global-delete button styles. It is offered for components that are neither global aliases nor built-in primitives. The picker's options are exactly primitives, global aliases and the app's generated project registry, so this means "a project component file". The registry `.ts` does not carry `source`. The control plane re-checks the manifest `source` and refuses anything outside `app/components/content/`.
- A one-line status under the tabs shows the parent's answer (accepted / cancelled / failed) for 6 s.

## Vite / HMR

Only the slot hostname is added to `allowedHosts`. **No `vite.server.hmr` override is set.** The Vite client derives the HMR socket from the page URL:
- `wss://hetzner1…:9181/_nuxt/` on the tailnet;
- `ws://localhost:9181` through an SSH tunnel.

The control plane's slot proxy passes WebSocket upgrades through and rewrites `Host` to the loopback upstream, which Vite accepts by default. Forcing `hmr.host`/`clientPort` would break whichever access path it did not name. Phase 0 spike S2 confirmed `[vite] connected.` through `tailscale serve` without an override.

### Agent reload guard (Phase 2)

While Codex generates a component it writes and rewrites `app/components/content/*.vue`, and the registry watcher rewrites `app/content-builder/component-definitions.{ts,json}` after each write. Without a guard, Vite reloads the builder page several times mid-run (observed 3× in the Phase 1 UI test).

`utils/agent-reload-guard.ts` adds a Vite plugin (client dev server only) when `nuxt.options.dev` **and** `COUCHFUSION_AGENT_MARKER` is set. It wraps `server.ws.send` — in Vite 7 the same object as the client environment's `hot` channel, so every HMR message passes through it — and, **only while the marker file exists**, drops:

| Message | Origin (observed on radustanciu, Nuxt 4.1.2 / Vite 7.3) | Rule |
|---|---|---|
| `full-reload` with `path:"*"`, `triggeredBy:<…/components/content/X.vue>` | content `import.meta.glob` (layer plugin) invalidation on add/delete | path or triggeredBy is a guarded path |
| `full-reload` without path | Vite propagation of the registry `.ts` change (module imported eagerly by `useComponentRegistry`) | inside the time window |
| `custom` `file-changed` `{file}` | `@vitejs/plugin-vue` `handleHotUpdate` for the `.vue` and the registry files | file is a guarded path |
| `prune` `[/components/content/X.vue]` | Vite on delete | all paths guarded |
| `update` (e.g. Tailwind `main.css` rebuild after a content `.vue` edit) | Tailwind v4 content scanning | inside the time window |

Guarded paths: anything under `/components/content/` and `/content-builder/component-definitions.*`. The time window (`GUARD_WINDOW_MS`, 2.5 s) opens on every watcher `add`/`change`/`unlink` of a guarded path while the marker exists; the listener is prepended so it runs before Vite's own handler. Other traffic (`connected`, `ping`, `error`, other custom events, updates outside the window) always passes, and with no marker file everything passes unchanged. When the job ends the control plane removes the marker and asks the builder to reload through the bridge, which picks up all changes at once.

Proof (local, port 4499, radustanciu + headless browser + raw HMR client): see `docs/implementation_results/2026-10-30T09-15-00+0200_agent-reload-guard.md`.

## Registry generator

`scripts/generate-component-registry.mjs` now reads sources through `scripts/read-component-source.mjs`. A `.vue` file that disappears between directory listing and reading is skipped with a warning instead of failing the whole run. Phase 0 spike S1 showed a delete during a watcher run crashed the generator with ENOENT.

## Tests

From `layers/`:
```bash
bunx vitest --config vitest.config.ts content/tests/server/control-plane-routes.spec.ts content/tests/server/control-page-operations.spec.ts content/tests/control-page-operations-db.spec.ts content/tests/server/agent-reload-guard.spec.ts content/tests/builder/control-plane-bridge.spec.ts --run
bun test content/tests/scripts/read-component-source.test.mjs
```
