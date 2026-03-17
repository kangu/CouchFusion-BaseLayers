# Page-scope LLM translation includes SEO title/description

## Scope
- Enabled SEO `title` and `description` translation when running LLM translation with `scopeMode = page`.
- Kept `section` and `field` scopes unchanged.
- Preserved minimal-impact behavior in existing body-pointer translation flow.

## Server changes
- Updated `server/api/content/llm-translations/translate.post.ts`:
  - Added synthetic translation pointers for page-scope SEO fields:
    - `/__seo/title`
    - `/__seo/description`
  - Appended SEO source entries to normal body entries only for page scope.
  - Resolved target text for eligibility checks from either body pointers or SEO pointers.
  - Split returned translations into body vs SEO buckets.
  - Applied body translations with existing `applyTranslationsToBody(...)`.
  - Applied SEO translations directly to `minimalDocument.seo` with overwrite semantics (`missing` / `all`).
  - Updated applied/skipped counts to include both body and SEO outcomes.

## Workbench draft application changes
- Updated `app/components/admin/ContentAdminWorkbench.vue`:
  - Added pointer-aware staged-draft updates for SEO keys:
    - `/__seo/title`
    - `/__seo/description`
  - Draft edits in the Translation Report now mutate staged document `seo` fields (not only body pointers).
  - Persist flow remains unchanged and now carries edited SEO draft values correctly.

## Tests
- Added `content/tests/llm-translations-seo.spec.ts` covering:
  - SEO entry collection in page scope only.
  - Target text resolution for SEO and body pointers.
  - Pointer splitting (SEO vs body).
  - SEO translation apply behavior for `overwriteMode = all` and `overwriteMode = missing`.

## Validation run
- `bunx vitest --config vitest.config.ts content/tests/llm-translations-seo.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/api-content-pages.spec.ts --run`

Both passed.
