# LLM request page operations — dev-server side (2026-11-02)

Contract: `cli-init/docs/superpowers/specs/2026-11-02-llm-request-contract.md` ("Control routes", "Operations"). Reference doc: `docs/couchfusion-control-plane-bridge.md` → "Page operations (LLM request)".

## What changed

- Four token-gated dev routes, registered with their method in `CONTROL_PLANE_ROUTES`:
  `GET /__couchfusion/control/pages`, `GET /__couchfusion/control/page-documents`, `POST /__couchfusion/control/pages/check`, `POST /__couchfusion/control/pages/apply` (handlers in `runtime/control-plane/`). `ping` and `component-usage` are unchanged.
- `server/utils/control-page-operations.ts`: page loading/grouping (canonical id over legacy root id, `oldpage-*` never in the `page-` range), listing, documents, check (simulated in-order state, problems, preview), apply (helpers in order, per-operation rev guard, written-doc report).
- `server/utils/content-page-publication.ts`: publication logic extracted from `server/api/content/pages/publication-state.patch.ts`; the handler now calls it (same validation, errors and response; only type annotations were added).
- `server/utils/component-usage.ts`: `collectMinimarkTags` (tag collector on the existing walker).
- `utils/register-control-plane-routes.ts`: route entries carry `method`; when enabled it sets `runtimeConfig.content.controlPlaneRegistryManifests` (registry manifest locations from `srcDir`/`rootDir`).

## Follow-up: `page.create` (same day)

- `{op: "page.create", path, title, body, seo?, layout?, publicationState?}` — default-locale page only, `publicationState` defaults to `draft`. Written with `saveLocalizedPageDocument(…, {isCreate: true})`, the same call as `POST /api/content/pages`, so the document shape matches a builder-created page and page history is saved (verified against CouchDB).
- Check: occupied path (existing page, created or moved there earlier in the proposal, or any leftover document id of the path), invalid / locale-prefixed / reserved / asset path, missing title or body, publicationState not `published`/`draft`, unknown fields, body and layout size limits, minimark shape, and **every** non-HTML tag must be a known component. The simulated state tracks the new page, so later operations can update (incl. a translation) or publish it.
- Preview: `path`, `title`, `seo.title`, `seo.description`, `seo.image`, `publicationState`, `body` outline, `layout` (when given), each `before: null`. The SEO values are what the save stores (`seo.title` falls back to the title, `seo.description` to the layer's `SEO description.`). `PageOperationChange.before` is now `string | null`.
- Apply: `{index, path, documents: [{id, rev}]}`. A page that appeared since the request → 409 from check, nothing written; appearing between check and write → per-operation rev guard stops with 500 before writing it.
- `parseContentFields` now holds the shared `title`/`seo`/`body`/`layout` parsing of create and update; `seoPayload` the shared SEO payload.

## Deviations from / additions to the contract

- `redirect.status` is **308** (what `app/middleware/content.global.ts` actually answers), not the 301 of the example. A misconfigured redirect is reported as `{to: <raw>, status: 404}` (the middleware answers 404).
- Malformed request envelope (`operations` not an array, more than 50 operations, `baseRevs` not an object of strings) → HTTP **400**, not a check problem.
- `page-documents`: unknown paths answer `{path, documents: []}`; locale document bodies are the builder's read view (master values merged at fixed body paths).
- Preview entries for `page.move` / `page.copyContent` also carry `from` and `to`; `applied[].documents[]` entries for a move without redirect carry `deleted: true` (tombstone rev).
- Unknown-component validation applies to tags **introduced** by a `page.update` body; tags already in that document's body are tolerated (otherwise any page that still references a removed component could never be edited). `copyContent` copies live content and is not re-validated.
- Extra problems beyond the contract list: unknown fields on an operation or in `seo`, locale-prefixed paths, moving the home page, move target on a reserved/asset path, `keepRedirect` missing, update of a redirect page, copy into a redirect page.
- `seo.title` / `seo.description` `null` = unchanged; `seo.image: null` clears the image (sent as `""` to `sanitiseIncomingDocument`, which merges with `??`).
- Page history: saved for `page.update` and `page.copyContent` (via `saveLocalizedPageDocument`, as a builder save). `page.move` and `page.publication` behave like their builder counterparts, which do not write history.

## Known limitations

- `copyContent` with a source that has no fixed body paths while the target has some: the save helper keeps the target's existing fixed paths (it cannot clear them), so values at those pointers are re-synced from the target master into translations, as a builder save would.
- The rev guard closes the check→write window per operation but cannot make an operation atomic: a concurrent write in the millisecond between the guard's read and the helper's own read is not detected (the helpers read the current rev themselves).
- Registry validation depends on `component-definitions.json`; if it is missing, every introduced non-HTML tag is reported (fail closed) with a message saying the registry was not found.

## Tests

From `layers/`:

```bash
bunx vitest --config vitest.config.ts content/tests/server/control-plane-routes.spec.ts content/tests/server/control-page-operations.spec.ts content/tests/control-page-operations-db.spec.ts --run
```

- `control-page-operations.spec.ts` (37 since `page.create`, mocked CouchDB + helpers): token gating 404 for all four handlers (no DB access, no writes), 400 envelopes, listing/documents, problems (unknown op/field, missing page, invalid fields, unknown component incl. aliases/HTML/primitives/globals, tolerated pre-existing tag, missing registry, 1 MB body, rev mismatch incl. translations, move target exists/redirect/home/reserved, copy from/into redirect, sequential simulation), preview strings and truncation, apply order and payloads, 409 writes nothing, 500 mid-way failure with `applied`, concurrent change after check; `page.create` problems, full component validation, simulated tracking, preview, apply with `isCreate: true` then update/publish, 409 when the page appeared, guard when it appears after the check.
- `control-page-operations-db.spec.ts` (4, real CouchDB harness, real helpers): list/documents, apply update + locale update + move with redirect + copyContent + publication, `page.create` (builder document shape, draft, history entry, then a translation; repeating it → 409 with no write), 409 on a stale `baseRevs` with no write.
- `control-plane-routes.spec.ts`: six routes with methods and existing handler files; manifest locations.
- Regression: `content/tests/server`, `api-content-pages` (publication-state handler), `content-page-url-rename`, `content-pages-save-i18n`, `content-page-redirect`, `api-global-components`, `builder/control-plane-bridge` — 138/138 pass (after `page.create`).
- Full `content/tests`: 254/257; the 3 failures (`builder/focused-editor-mode`, `admin/content-admin-workbench-translation-menu`) fail identically on a clean `HEAD` checkout.
- Typecheck (`tsc -p apps/radustanciu/.nuxt/tsconfig.server.json`): no errors in the touched files (the project has pre-existing errors elsewhere).
