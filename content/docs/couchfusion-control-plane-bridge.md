# CouchFusion control-plane bridge (dev sessions)

The CouchFusion control plane (Rust server on the VPS, `cli-init/server`) runs an app's `nuxt dev` in a sandboxed systemd unit and shows the builder full screen inside its own web UI. This layer provides the dev-server side of that integration:

- two **token-gated control routes** the control plane calls over loopback;
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

Verified against `apps/radustanciu` by loading its Nuxt config: no env → no routes; production build with the vars set → no routes; dev with the token → exactly the two routes.

## Environment (injected by the control plane)

Written by the control plane to `/run/couchfusion/dev/<app>.env` before it starts `cf-dev@<app>`:

| Variable | Purpose |
|---|---|
| `COUCHFUSION_CONTROL_TOKEN` | Per-start secret; required in header `x-couchfusion-control-token` on the control routes. |
| `COUCHFUSION_PUBLIC_ORIGIN` | The dev slot origin the browser uses, e.g. `https://hetzner1.tailb7471b.ts.net:9181`. Only its hostname is used (Vite `allowedHosts`). |
| `NUXT_PUBLIC_CONTENT_CONTROL_PLANE_ORIGINS` | Comma-separated control-plane origins the bridge may talk to (fills `runtimeConfig.public.content.controlPlane.origins`). |

**Why these are not `cf_env_[slug]` parameters.** The repo rule says layers read app environment parameters from CouchDB `_config` (`cf_env_<slug>`). These values are different in kind: they are per-process supervisor injections that change on every dev start (the token), describe how this particular process is reached (the slot origin), and must never exist in production. Storing them in `_config` would make them shared, persistent and visible to production — the opposite of what they are for. They follow the same pattern as the existing `COUCHFUSION_PREVIEW` / `COUCHFUSION_PREVIEW_TOKEN` preview-host variables. Application parameters (ImageKit, analytics, …) still come from `cf_env_<slug>`.

## Control routes

Registered as Nitro handlers from `runtime/control-plane/`:

| Route | Response |
|---|---|
| `GET /__couchfusion/control/ping` | `{"ready": true}` — readiness probe used instead of scraping logs. |
| `GET /__couchfusion/control/component-usage?id=<kebab-id>` | `{"pages": [{"id","path","title"}], "scanned": <n>}` — pages that reference the component. `400` for an invalid id. |

The token comparison is constant time (`runtime/control-plane/token.ts`). Responses are `Cache-Control: no-store`.

### Usage scan

`server/utils/component-usage.ts` (`findComponentPageUsage`) walks every `page-*` document's `body.value` minimark tree and matches component tags against the registry id (`network-hero`) and its PascalCase alias (`NetworkHero`), at any depth. Locale variants are separate full documents (`page-<path>::<locale>`) in the same key range, so all locales are covered. `oldpage-*` history is skipped. Bare text nodes do not count.

`server/utils/global-component-usage.ts` now delegates to the same walker with `matchTextNodes: true`, which preserves its historical behaviour exactly (it used to count a text node equal to the alias).

The scan is advisory: references from global-component definitions, design documents or translations are not covered. The control plane also scans code references and soft-deletes into trash.

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

## Registry generator

`scripts/generate-component-registry.mjs` now reads sources through `scripts/read-component-source.mjs`. A `.vue` file that disappears between directory listing and reading is skipped with a warning instead of failing the whole run. Phase 0 spike S1 showed a delete during a watcher run crashed the generator with ENOENT.

## Tests

From `layers/`:
```bash
bunx vitest --config vitest.config.ts content/tests/server/control-plane-routes.spec.ts content/tests/builder/control-plane-bridge.spec.ts --run
bun test content/tests/scripts/read-component-source.test.mjs
```
