# Content layer readiness assessment

## Initial prompt

Analyse the current project state thoroughly considering all aspects involved, review the past work from `/docs` folders, and prepare to implement features.

## Scope and evidence

- Reviewed the layer configuration, package contract, source and test inventory, active specifications, and implementation-result history.
- Reviewed the prior state assessments from 2026-03-04, 2026-04-23, and 2026-07-05; the 2026-07-03 draft-page design and implementation plan; and the 2026-07-15 entry-session result.
- Inspected the working-tree changes in `app/middleware/content.global.ts` and `utils/page.ts` without modifying them.
- Ran the canonical focused test command from `layers/`:
  `bunx vitest --config vitest.config.ts content/tests/content-route-access.spec.ts content/tests/builder/route-access-editor.spec.ts content/tests/api-content-pages.spec.ts --run --reporter=dot`.

## Current state

`content` is a mature Nuxt layer extending `database`. It owns content-page storage and APIs, runtime routing/rendering, the admin pages workbench, the node editor and inline preview bridge, translations and locale metadata, asset/image workflows, page history, and runtime font/theme configuration.

The draft-page plan is complete, despite its historical checklist remaining unchecked. `publicationState` is normalized in document and API conversion, drafts are protected in the pages API, the admin list can create, clone, filter, and change state, and the sitemap layer excludes drafts. The focused suite confirms this behavior along with master-only localized mutations.

Entry-session route access is the active implementation seam. Shared parser/editor helpers and their focused contracts are present. The current uncommitted middleware change extends enforcement to ignored-but-eligible app routes, recognizes builder preview, and sets a path-scoped session marker. Treat it as in-progress user work: do not rework or overwrite it without its owner’s direction.

## Verification

Focused baseline: **3 files, 37 tests passed**.

The broad layer command, `bunx vitest --config vitest.config.ts content/tests --run`, currently reports **3 failures**:

1. Two `content-admin-workbench-translation-menu` tests resolve `app/components/...` from the `layers/` working directory, but the component is under `content/app/...`.
2. One focused-editor static-source assertion expects a removed/stale exact call expression (`void restoreTreeFocusAfterFocusedEdit(session)`).

These are test-maintenance failures rather than evidence of a CouchDB or product regression. `git diff --check` was clean at assessment time.

## Implementation-ready backlog

1. Finish and review the existing route-access middleware work first. Add middleware-level SSR and client-navigation tests for public routes outside the normal content prefix, locale-prefixed paths, redirect loops, cookie scope, invalid persisted policies, and builder iframe bypass.
2. Repair the three broad-suite test contracts so the documented canonical command is green. Use repository-relative paths in static tests and assert behavior rather than a brittle internal call string where possible.
3. Keep draft-page work out of the next feature plan unless a new publication requirement is requested; it is already delivered and covered, including sitemap exclusion.
4. For new builder/runtime work, protect the highest-churn seams (`ContentAdminWorkbench.vue`, `Workbench.vue`, `content.global.ts`, and `useContentLiveUpdates.ts`) with focused tests before UI changes.

## Operational constraints

- Run content tests from `/Users/radu/Projects/nuxt-apps/layers`, using `vitest.config.ts`; root-level invocation has historically resolved setup paths incorrectly.
- Content-layer changes have broad consumer impact. Select a consuming app explicitly before app-level verification.
- Preserve the existing dirty workspace; this assessment made no source-code changes.
