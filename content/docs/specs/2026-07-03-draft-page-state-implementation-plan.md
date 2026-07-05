# Draft Page State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add page-level draft/published state, enforced server-side, editable inline from `/admin/pages`, and omitted from sitemap output.

**Architecture:** Store `publicationState` on the master content page document and normalize missing stored values to `published`. Keep draft access checks in the server page API so runtime middleware, public page rendering, and admin preview all share one source of truth. Use a focused publication-state endpoint for inline admin row edits instead of full page saves.

**Tech Stack:** Nuxt 4 layer code, Vue 3, Pinia, H3 API handlers, CouchDB design views, Vitest CouchDB harness, Bitvocation as consuming app.

---

### Task 1: Publication State Model And Server Read Tests

**Files:**
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/types/content-page.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/utils/page-documents.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/_tests/fixtures/content.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/tests/api-content-pages.spec.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/server/utils/auth.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/pages.get.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/app/stores/pages.ts`

- [ ] **Step 1: Write failing API tests**
  - Add tests showing legacy pages normalize to `published`, anonymous draft page fetch returns 404, admin draft fetch succeeds, editor draft fetch succeeds, and page index exposes `publicationState`.

- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd /Users/radu/Projects/nuxt-apps/layers && bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`
  - Expected: failures because `publicationState` and draft access logic do not exist yet.

- [ ] **Step 3: Implement minimal model/read support**
  - Add `ContentPagePublicationState` type and summary/document fields.
  - Add `normalizePublicationState`.
  - Preserve publication state through document normalization and store extraction.
  - Add optional content-editor session resolution for `admin`, `_admin`, and `editor`.
  - Enforce draft reads in `pages.get.ts` by checking the master document.

- [ ] **Step 4: Run tests to verify pass**
  - Run the same focused API test command.

### Task 2: Inline Publication-State Mutation Endpoint

**Files:**
- Create: `/Users/radu/Projects/nuxt-apps/layers/content/server/api/content/pages/publication-state.patch.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/app/stores/pages.ts`
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/tests/api-content-pages.spec.ts`

- [ ] **Step 1: Write failing endpoint/store tests**
  - Add API tests showing invalid state returns 400, editor/admin can update a master page state, and locale documents are not mutated.

- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd /Users/radu/Projects/nuxt-apps/layers && bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`
  - Expected: failures because endpoint does not exist.

- [ ] **Step 3: Implement endpoint and store action**
  - Resolve base path and master document.
  - Update only master `publicationState` and `updatedAt`.
  - Return a page-shaped response.
  - Add `updatePublicationState` to the Pinia store.

- [ ] **Step 4: Run tests to verify pass**
  - Run the focused API test command.

### Task 3: Admin Pages Inline UI

**Files:**
- Modify: `/Users/radu/Projects/nuxt-apps/layers/content/app/pages/admin/pages.vue`

- [ ] **Step 1: Add UI state and behavior**
  - Add publication filter `all | published | draft`.
  - Add row-level pending state for publication saves.
  - Add `handlePublicationStateChange(page, state)` using the store action with optimistic revert on failure.

- [ ] **Step 2: Add inline row control**
  - Add `Status` column before `Updated`.
  - Use a compact select for `Published` and `Draft`.
  - Include disabled/pending state per row.

- [ ] **Step 3: Default create/clone to draft**
  - Ensure create and clone payloads send `publicationState: 'draft'`.

- [ ] **Step 4: Verify prepare**
  - Run: `cd /Users/radu/Projects/nuxt-apps/apps/bitvocation && bunx nuxi prepare`
  - Do not run `bun run build` per Bitvocation instructions.

### Task 4: Sitemap Exclusion

**Files:**
- Modify: `/Users/radu/Projects/nuxt-apps/layers/sitemap-xml/server/api/sitemap.xml.get.ts`
- Create or modify: `/Users/radu/Projects/nuxt-apps/layers/sitemap-xml/tests/sitemap-content-drafts.spec.ts` if test harness allows isolated sitemap testing; otherwise add coverage to existing content API tests where practical.

- [ ] **Step 1: Write failing sitemap coverage or targeted unit test**
  - Show draft content routes are omitted while published content routes remain.

- [ ] **Step 2: Run test to verify failure**
  - Run the chosen focused vitest command.

- [ ] **Step 3: Implement draft filter**
  - Import/use `normalizePublicationState`.
  - Skip docs whose master content document normalizes to `draft`.

- [ ] **Step 4: Run test to verify pass**
  - Run the focused test command.

### Task 5: Documentation And Verification

**Files:**
- Create: `/Users/radu/Projects/nuxt-apps/apps/bitvocation/docs/implementation_results/<timestamp>_draft_page_state_admin_inline_status.md`
- Optionally modify: `/Users/radu/Projects/nuxt-apps/layers/content/docs/implementation_results/<timestamp>_draft_page_state.md`

- [ ] **Step 1: Run focused verification**
  - `cd /Users/radu/Projects/nuxt-apps/layers && bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`
  - Any sitemap-focused test command added in Task 4.
  - `cd /Users/radu/Projects/nuxt-apps/apps/bitvocation && bunx nuxi prepare`

- [ ] **Step 2: Persist implementation result**
  - Include Initial Prompt, Plan, Implementation Summary, Verification, and Next Steps.

- [ ] **Step 3: Final status**
  - Report changed files, verification evidence, and any limitations.
