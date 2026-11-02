# CouchFusion control-plane bridge — content layer (Phase 1, Stream C)

## Initial prompt
Implement the content-layer side of the Phase 1 control plane MVP: token-gated control routes (`ping`, `component-usage`), a generalised component page-usage scan, the child side of the postMessage bridge, host-only "New component" / "delete file" picker actions, dirty/reload/focus wiring, and the registry generator ENOENT fix. Inert in every app without the supervisor env and in production. Contract: `cli-init/docs/superpowers/specs/2026-10-29-phase1-mvp-contract.md`.

## Plan followed
1. Read the layer `agents.md`, the preview-host registration pattern, the global usage scan, the picker, InlineLiveEditor and Workbench.
2. Generator fix first, with tests (`read-component-source.mjs`).
3. Shared usage walker; global path delegates to it, behaviour unchanged.
4. Control routes and dev-only registration module, plus the `controlPlane.origins` public runtime config.
5. Child bridge as a pure core with a thin Nuxt wrapper; unit tests with a fake host window.
6. UI wiring: picker buttons and status, InlineLiveEditor dirty/reload, Workbench focus → open picker.
7. Verify: unit tests, existing builder/admin suites, and a gating check that loads radustanciu's Nuxt config with and without the env.

## Implementation summary
| File | Change |
|---|---|
| `nuxt.config.ts` | New module `utils/register-control-plane-routes`; `runtimeConfig.public.content.controlPlane.origins: ""`. |
| `utils/register-control-plane-routes.ts` (new) | Registers `GET /__couchfusion/control/{ping,component-usage}` only when dev + `COUCHFUSION_CONTROL_TOKEN`; adds the `COUCHFUSION_PUBLIC_ORIGIN` hostname to `vite.server.allowedHosts` in dev; no HMR override. |
| `runtime/control-plane/{token,ping.get,component-usage.get}.ts` (new) | Constant-time header token check (404 otherwise), handlers. |
| `server/utils/component-usage.ts` (new) | `findComponentPageUsage(id)` → `{pages, scanned}`; kebab + PascalCase tags at any depth; all locale docs; skips `oldpage-`. |
| `server/utils/global-component-usage.ts` | Delegates to the shared walker (`matchTextNodes: true` keeps old behaviour). |
| `app/composables/useControlPlaneBridge.ts` (new) | Child bridge (ready/welcome, origin + nonce pinning, requests with 120 s timeout, reload handler, dirty, focus). |
| `app/components/builder/ComponentPickerDialog.vue` | "New component" header button, per-card "delete file" button, status line, focus scroll/highlight; all gated on `connected`. |
| `app/components/inline/InlineLiveEditor.vue` | Starts the bridge as builder; reports dirty; reload handler (confirm when dirty, then drop the unload guard). |
| `app/components/builder/Workbench.vue` | Opens the root picker when the bridge has a focus request (`immediate`, since Workbench may mount late). |
| `scripts/read-component-source.mjs` (new), `scripts/generate-component-registry.mjs` | Skip `.vue` files that vanish mid-run instead of failing. |
| Tests (new) | `tests/server/control-plane-routes.spec.ts` (13), `tests/builder/control-plane-bridge.spec.ts` (9 + parse), `tests/scripts/read-component-source.test.mjs` (5). |
| Docs | `docs/couchfusion-control-plane-bridge.md`. |

## Verification
- New tests: 24/24 vitest (with the existing preview-registration spec) and 5/5 bun.
- Existing suites run from `layers/` (`content/tests/builder`, `content/tests/admin`): 111 passed, 3 failed. All 3 failures predate this work:
  - `focused-editor-mode` expects a Workbench string that is absent at `HEAD` too.
  - `content-admin-workbench-translation-menu` resolves a fixture path against the working directory.
- `tests/scripts/generator-contract.test.mjs` "retains image hints" fails because the uncommitted working-tree edit removed `applyImageFieldUi`. That is unrelated.
- Gating, by loading `apps/radustanciu` Nuxt config via `@nuxt/kit` (no server started, registry watcher off):
  - dev without env → no routes, `allowedHosts` untouched;
  - production with the env → no routes;
  - dev with the env → exactly the two routes plus the slot hostname.

## Next steps
- End-to-end on hetzner1 once the Rust server (Stream A) and the SPA page (Stream B) land: handshake, delete flow, create → reload → focus.
- Phase 2: wire the child picker in `NodeChildrenPanel` (it reuses the dialog, so the buttons already appear there; focus only opens the root picker).
