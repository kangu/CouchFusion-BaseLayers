# Initial Prompt
Update the translation report to include token usage for the LLM call.

# Plan
1. Capture token usage from the LLM completion response in the server translation runner.
2. Thread token usage into the translation API response for each locale result (including response-error cases when usage exists).
3. Extend client-side report typings to include token usage metadata.
4. Render token usage in the translation report modal with minimal UI impact.

# Implementation Summary
Updated token usage flow end-to-end with minimal surface changes:

- `layers/content/server/utils/llm-translations-run.ts`
  - Added `TranslationTokenUsage` type.
  - Added `tokenUsage` field to `TranslationLocaleExecutionResult`.
  - Extracted usage from provider completion (`prompt_tokens`, `completion_tokens`, `total_tokens`, and optional reasoning/cached details).
  - Included token usage in successful locale results.
  - Included token usage in thrown response errors where completion usage is available (empty content / invalid payload paths).

- `layers/content/server/api/content/llm-translations/translate.post.ts`
  - Forwarded `tokenUsage` into each `localeResults` entry for successful runs.
  - Added safe normalization for `error.data.tokenUsage` and included it on error locale entries.

- `layers/content/app/composables/useLlmTranslations.ts`
  - Added `LlmTranslationTokenUsage` interface.
  - Added optional `tokenUsage` field to `LlmTranslationLocaleReportEntry`.

- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
  - Added aggregated token usage computation across locale results.
  - Added token usage line in report summary.
  - Added per-locale token usage line in the active locale result card.

Result: the Translation report now shows token usage metrics from the LLM call directly in the UI.

# Next Steps
1. Run a translation and confirm report displays totals plus per-locale token usage.
2. For failed runs, verify token usage appears when provider returns completion usage metadata.
