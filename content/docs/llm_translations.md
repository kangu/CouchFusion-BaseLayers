# Content Layer LLM Translations Spec

## Goals
- Implement a view composable module in the content layer for LLM-powered translations.
- Integrate translation actions in Content Admin Workbench, Builder Workbench, and Node editor fields.
- Support:
  - page-level bulk translation
  - section-level translation (all `localized: true` texts in that section)
  - field-level translation (including nested localized fields)
- Keep translations staged in editor and require manual Save Changes per locale.
- Keep translation configuration in CouchDB doc `_id: "llm-translations"`.
- Read OpenAI key from low-level CouchDB config `cf_openai.api_key` during startup initialization.

## Decisions (Confirmed)
- Source locale is always the currently active locale.
- Translation target is one or more selected locales.
- Overwrite behavior is user-selected for each run.
- All translation endpoints are admin-session protected.
- Field-level translate action UI is inline (button at end of flex row near input/rich text).
- Inline field translation should also work for nested localized fields.
- Translation results must show report + quick-open action for translated locales.
- Stage only in editor; do not auto-save translated locale documents.

## Sections and Progress
- [x] Section 0: Spec checklist + confirmed decisions documented for resumable work.
- [x] Section 1: Startup config initialization from CouchDB (`llm-translations` + `cf_openai.api_key`).
- [x] Section 2: Server translation API (OpenAI-compatible call + page/section/field modes).
- [x] Section 3: Content-layer translation composable for UI consumers.
- [x] Section 4: Workbench integration (target locales, overwrite choice, page translation action).
- [x] Section 5: Node integration (section action + inline field actions including nested fields).
- [x] Section 6: Stage-in-editor behavior per locale + translation report + quick-open locale action.
- [x] Section 7: Validation and implementation results documentation.

## Reference
- OpenAI-compatible endpoint style reference:
  - `/Users/radu/Projects/nuxt-apps/apps/bitvocation/server/api/career-compass/generate.post.ts`
