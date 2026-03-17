# Translation Error Surfacing + Progress Panel

## Scope
- Surface provider-level translation failures to frontend locale reports/notices.
- Show a translation progress panel while translation requests are running.

## Changes
- `content/server/utils/llm-translations-run.ts`
  - Kept full `/chat/completions` request body logging.
  - Added structured `data` on translation API failures:
    - `providerStatus`
    - `providerStatusText`
    - `providerResponseText`
  - Expanded thrown error message to include provider status + response payload text.

- `content/server/api/content/llm-translations/translate.post.ts`
  - Added `resolveLocaleTranslationError(error)` helper to normalize H3/provider errors.
  - Locale report entries now carry normalized detailed error messages via `localeResults[].error`.

- `content/app/composables/useLlmTranslations.ts`
  - Added client-side request error normalization from multiple fetch/H3 shapes.
  - Re-throws normalized message so workbench notices show actionable backend error text.

- `content/app/components/admin/ContentAdminWorkbench.vue`
  - Added translation progress panel UI while pending.
  - Added locale failure details list in translation report panel.
  - Expanded failure notice to include first failing locale and error details.

## Validation
- `bun run build` (from `apps/radustanciu`) passed.
