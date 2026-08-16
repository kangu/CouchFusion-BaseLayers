# Page URL Rename Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename a saved page and every existing localized document, deleting old routes by default or retaining them as 308 redirects when selected.

**Architecture:** A `page-redirect` utility owns validated permanent redirect metadata. A server migration service preflights locale IDs, creates every target, then deletes or converts old documents. The store calls one endpoint; Workbench UI emits an intent and the admin workbench reloads the result.

**Tech Stack:** Nuxt 3/4, Vue 3, Pinia, H3, CouchDB, Vitest.

## Global Constraints

- Work only in `layers/content`; preserve current uncommitted middleware/page utility changes.
- Only saved default-locale pages can start a rename; translated page editors are read-only.
- `keepRedirect` defaults to `false`; redirect metadata is `meta.redirectTo`, never `meta.routeAccess`.
- Redirect documents are published, contain a minimal empty body, retain locale identity only, and use 308 responses.
- New documents preserve body, SEO, navigation, publication state, layout, and non-redirect metadata. Do not move histories or rewrite links in other pages.
- Run tests from `/Users/radu/Projects/nuxt-apps/layers` using `bunx vitest --config vitest.config.ts`.

---

### Task 1: Redirect metadata contract

**Files:**
- Create: `content/utils/page-redirect.ts`
- Create: `content/tests/content-page-redirect.spec.ts`
- Modify: `content/types/content-page.ts`

**Interfaces:** `parseContentPageRedirect(meta, sourcePath)` returns `{ status: 'none' }`, `{ status: 'valid'; targetPath: string }`, or `{ status: 'invalid'; reason: string }`. `createContentPageRedirectMeta(targetPath)` returns `{ redirectTo: string }`.

- [ ] **Step 1: Write failing tests**

```ts
expect(parseContentPageRedirect({ redirectTo: ' /new/ ' }, '/old')).toEqual({ status: 'valid', targetPath: '/new' })
for (const target of ['/old', 'https://x.test/new', '/new?x=1', '/new#x']) {
  expect(parseContentPageRedirect({ redirectTo: target }, '/old').status).toBe('invalid')
}
expect(createContentPageRedirectMeta('/new')).toEqual({ redirectTo: '/new' })
```

- [ ] **Step 2: Verify failure**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-redirect.spec.ts --run`

Expected: FAIL because the helper is absent.

- [ ] **Step 3: Implement the helper**

```ts
const target = normalizeContentRoutePath(record.redirectTo)
const source = normalizeContentRoutePath(sourcePath)
if (!target || !source || target === source) return { status: 'invalid', reason: 'Redirect target must be a different internal path' }
return { status: 'valid', targetPath: target }
```

Use `normalizeContentRoutePath` from `route-access.ts`; do not duplicate URL rules. Add optional `redirectTo?: string` to `ContentPageDocument`.

- [ ] **Step 4: Verify pass and commit**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-redirect.spec.ts --run`

```bash
git add layers/content/types/content-page.ts layers/content/utils/page-redirect.ts layers/content/tests/content-page-redirect.spec.ts
git commit -m "feat(content): define page redirect metadata"
```

### Task 2: Recoverable page and locale migration service

**Files:**
- Create: `content/server/utils/content-page-url-rename.ts`
- Create: `content/tests/content-page-url-rename.spec.ts`
- Modify: `content/server/utils/content-i18n.ts`

**Interfaces:** Export `interface ContentPageUrlRenameInput { sourcePath: string; targetPath: string; keepRedirect: boolean }` and `renameContentPageUrl(input: ContentPageUrlRenameInput)`. It returns `{ page, sourcePath, targetPath, migratedLocales, redirectRetained, completed: { created, retired } }`. Write failures expose the same `completed` object under H3 error `data`.

- [ ] **Step 1: Write failing service tests**

```ts
const result = await renameContentPageUrl({ sourcePath: '/old', targetPath: '/new', keepRedirect: false })
expect(result).toMatchObject({ targetPath: '/new', migratedLocales: ['en'], redirectRetained: false })
expect(await readPage('/old')).toBeNull()
expect(await readPage('/new')).toMatchObject({ path: '/new', publicationState: 'draft' })
await renameContentPageUrl({ sourcePath: '/old', targetPath: '/new', keepRedirect: true })
expect((await readPage('/old', 'ro'))?.meta).toEqual({ redirectTo: '/new' })
```

Seed a master and Romanian document. Add tests for target collision, equal paths, missing source, reserved target, source redirect, target preservation of route access, redirect removal of route access, and injected second-write failure.

- [ ] **Step 2: Verify failure**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-url-rename.spec.ts --run`

Expected: FAIL because the service is absent.

- [ ] **Step 3: Implement preflight and target construction**

Use `getEffectiveContentI18nConfig`, `buildLocaleDocumentIds`, `getLocaleDocumentId`, `getContentDatabaseName`, `getAllDocs`, `putDocument`, `clonePageDocument`, `deriveStem`, and `normalizePagePath`. Fetch all source and target IDs once. Reject an occupied target before a write. Migrate only locale documents that exist. Clear `_rev`, assign target ID/path/stem, and rewrite `meta.contentI18n.masterId` and `basePath`.

- [ ] **Step 4: Implement ordered writes**

```ts
for (const targetDocument of targetDocuments) { await putDocument(databaseName, targetDocument); completed.created.push(targetDocument._id) }
for (const sourceDocument of sourceDocuments) {
  await putDocument(databaseName, input.keepRedirect ? makeRedirectDocument(sourceDocument, targetBySourceId.get(sourceDocument._id)!) : { _id: sourceDocument._id, _rev: sourceDocument._rev, _deleted: true })
  completed.retired.push(sourceDocument._id)
}
```

`makeRedirectDocument` keeps only identity, locale metadata, type, route/stem, timestamps, published state, empty body, and `{ redirectTo }`. Wrap a mutation error with `createError({ statusCode: 500, statusMessage: 'Page URL rename stopped before completion', data: { completed } })`.

- [ ] **Step 5: Verify pass and commit**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-url-rename.spec.ts --run`

```bash
git add layers/content/server/utils/content-i18n.ts layers/content/server/utils/content-page-url-rename.ts layers/content/tests/content-page-url-rename.spec.ts
git commit -m "feat(content): migrate localized page URLs safely"
```

### Task 3: Authorized endpoint and Pinia action

**Files:**
- Create: `content/server/api/content/pages/rename-url.post.ts`
- Modify: `content/server/utils/auth.ts`
- Modify: `content/app/stores/pages.ts`
- Modify: `content/tests/api-content-pages.spec.ts`

**Interfaces:** `POST /api/content/pages/rename-url` receives `{ sourcePath, targetPath, keepRedirect }`. `renamePageUrl(input)` calls it, clears old locale page/history caches, refreshes index, and returns the migration result.

- [ ] **Step 1: Write failing authorization and route tests**

```ts
await expect(renameUrlHandler(eventWithBody({ sourcePath: '/old', targetPath: '/new', keepRedirect: false }))).rejects.toMatchObject({ statusCode: 401 })
await expect(renameUrlHandler(await authenticatedEditorEvent({ sourcePath: '/old', targetPath: '/new', keepRedirect: false }))).resolves.toMatchObject({ success: true, page: { path: '/new' } })
```

Assert the store uses POST and removes aliases for all configured locales.

- [ ] **Step 2: Verify failure**

Run: `bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`

Expected: FAIL because the route and action are absent.

- [ ] **Step 3: Implement the boundary**

```ts
await requireContentEditorSession(event)
const body = await readBody<ContentPageUrlRenameInput>(event)
return { success: true, ...(await renameContentPageUrl(body)) }
```

The authorization helper accepts `admin`, `_admin`, and `editor`. Do not emulate migration with `saveDocument` then `deletePage` in the store.

- [ ] **Step 4: Verify pass and commit**

Run: `bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`

```bash
git add layers/content/server/api/content/pages/rename-url.post.ts layers/content/server/utils/auth.ts layers/content/app/stores/pages.ts layers/content/tests/api-content-pages.spec.ts
git commit -m "feat(content): expose page URL migration API"
```

### Task 4: Runtime 308 redirect handling

**Files:**
- Modify: `content/app/middleware/content.global.ts`
- Modify: `content/tests/content-page-redirect.spec.ts`

**Interfaces:** Middleware parses redirect metadata before `parseContentRouteAccessPolicy`; valid data returns a locale-aware 308 and malformed data returns 404.

- [ ] **Step 1: Write a failing middleware contract test**

```ts
expect(source.indexOf('parseContentPageRedirect')).toBeLessThan(source.indexOf('parseContentRouteAccessPolicy'))
expect(source).toContain('redirectCode: 308')
```

- [ ] **Step 2: Verify failure**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-redirect.spec.ts --run`

Expected: FAIL because middleware has no redirect branch.

- [ ] **Step 3: Add redirect before access evaluation**

After fetching the page summary, parse `summary.document.meta ?? summary.meta`. For valid metadata return `navigateTo(buildLocalizedPath(targetPath, localizedPath.locale, contentI18nConfig), { redirectCode: 308 })`. For invalid metadata abort with `Content page redirect is misconfigured`. Only then evaluate route access.

- [ ] **Step 4: Verify pass and commit**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-redirect.spec.ts content/tests/content-route-access.spec.ts --run`

```bash
git add layers/content/app/middleware/content.global.ts layers/content/tests/content-page-redirect.spec.ts
git commit -m "feat(content): redirect migrated page URLs permanently"
```

### Task 5: Workbench Rename URL dialog and ownership

**Files:**
- Modify: `content/app/components/builder/Workbench.vue`
- Modify: `content/app/components/admin/ContentAdminWorkbench.vue`
- Create: `content/tests/builder/page-url-rename.spec.ts`

**Interfaces:** Workbench emits `rename-page-url` payload `{ sourcePath, targetPath, keepRedirect }`. Admin calls `contentStore.renamePageUrl`, clears staged locales, and opens `result.page.path`.

- [ ] **Step 1: Write failing UI-contract tests**

```ts
expect(workbench).toContain('Rename URL')
expect(workbench).toContain('Keep permanent redirect from old URL')
expect(workbench).toContain('keepRedirect: false')
expect(workbench).toContain('(e: "rename-page-url", payload:')
expect(admin).toContain('@rename-page-url="handleRenamePageUrl"')
expect(admin).toContain('await contentStore.renamePageUrl(payload)')
expect(admin).toContain('await openPageForEditing(result.page.path, true)')
```

Assert translated/dirty pages cannot submit and ordinary save blocks a serialized path change.

- [ ] **Step 2: Verify failure**

Run: `bunx vitest --config vitest.config.ts content/tests/builder/page-url-rename.spec.ts --run`

Expected: FAIL because dialog, event, and handler are absent.

- [ ] **Step 3: Implement Workbench dialog**

Add dialog refs initialized as `{ targetPath: pageConfig.path, keepRedirect: false }`. Place `Rename URL` beside the URL input. Disable it when no ID, unsaved SEO draft, non-default locale, or focused operation. Validate a distinct normalized path; show source, target, locale impact, checkbox, cancellation, destructive confirmation, and recoverable error.

- [ ] **Step 4: Implement parent orchestration and save guard**

The admin handler blocks concurrent save, calls the store, refreshes selection, clears staged documents/translation state, and loads the result. Display `data.completed` on partial error. Before normal save, compare serialized and selected base paths and stop with `Use Rename URL to move this page and its translations safely.`

- [ ] **Step 5: Verify pass and commit**

Run: `bunx vitest --config vitest.config.ts content/tests/builder/page-url-rename.spec.ts --run`

```bash
git add layers/content/app/components/builder/Workbench.vue layers/content/app/components/admin/ContentAdminWorkbench.vue layers/content/tests/builder/page-url-rename.spec.ts
git commit -m "feat(content): rename page URLs from the workbench"
```

### Task 6: Full verification and result record

**Files:**
- Create: `content/docs/implementation_results/<timestamp>_page_url_rename_migration.md`

- [ ] **Step 1: Run focused feature suite**

Run: `bunx vitest --config vitest.config.ts content/tests/content-page-redirect.spec.ts content/tests/content-page-url-rename.spec.ts content/tests/api-content-pages.spec.ts content/tests/content-route-access.spec.ts content/tests/builder/page-url-rename.spec.ts --run`

Expected: PASS.

- [ ] **Step 2: Run broader verification**

Run: `bunx vitest --config vitest.config.ts content/tests --run`

Run: `git diff --check`

Expected: feature tests pass and no whitespace errors; record the known unrelated static-test failures separately if still present.

- [ ] **Step 3: Document and commit**

Record the request, default deletion, optional redirects, locale coverage, recovery behavior, and verification evidence.

```bash
git add layers/content/docs/implementation_results
git commit -m "docs(content): record page URL migration"
```
