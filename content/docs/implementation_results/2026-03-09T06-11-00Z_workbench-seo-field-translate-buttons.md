# Workbench SEO field translate buttons

## Scope
- Added explicit translate buttons next to SEO title and SEO description inputs in the builder SEO editor.
- Wired these buttons to field-scope translation pointers for SEO fields.
- Kept impact minimal by reusing existing `translate-scope` flow.

## UI changes
- Updated `app/components/builder/Workbench.vue`:
  - Added `Translate` button beside:
    - `SEO title`
    - `SEO description`
  - Added `handleTranslateSeoField(...)` handler that emits:
    - `scopeMode: "field"`
    - `scopePointer: "/__seo/title"` or `"/__seo/description"`
  - Syncs current SEO draft text into `pageConfig` before opening translation modal so source values reflect current input state.

## Server support
- Updated `server/api/content/llm-translations/translate.post.ts` SEO entry collection:
  - SEO entries are now collected for:
    - `scopeMode = "page"` (both fields)
    - `scopeMode = "field"` when `scopePointer` is one of:
      - `/__seo/title`
      - `/__seo/description`

## Tests
- Updated `content/tests/llm-translations-seo.spec.ts`:
  - Added assertions for field-scope SEO pointer selection behavior.

## Validation run
- `bunx vitest --config vitest.config.ts content/tests/llm-translations-seo.spec.ts --run`
- Passed.
