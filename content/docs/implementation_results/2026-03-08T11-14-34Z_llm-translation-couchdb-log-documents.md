# Initial Prompt
I wanted so were the console logs for the input to the translation llm and the output of the llm to plug in a CouchDB logging architecture where log documents are saved for later inspection of the performance of the LLM and the inputs and the outputs.

# Plan Followed
1. Locate the LLM translation execution path where request/response console logs are emitted.
2. Add a dedicated utility to persist translation run logs as CouchDB documents.
3. Capture request payload, provider response, errors, and duration per locale execution.
4. Attach translation context (path/scope/overwrite/entry counts) from translate API.
5. Keep logging non-fatal so translation flow still succeeds even if log writes fail.

# Implementation Summary
## Added CouchDB log utility
- New file: `layers/content/server/utils/llm-translations-logs.ts`
- Introduced log document type: `llm-translation-log`
- Persisted fields include:
  - `createdAt`
  - `sourceLocale`, `targetLocale`
  - `entryCount`
  - `status`: `success | provider_error | response_error`
  - `durationMs`
  - full `requestBody` sent to `/chat/completions`
  - `responseBody` (provider JSON)
  - `responseContent` (model message content)
  - `translationsByPointer` (on success)
  - `notes` (on success)
  - `error` payload (message/status/response text)
  - `context` (path/scope/overwrite/entry counts)
- Log `_id` format:
  - `llm-translation-log:<ISO timestamp>:<uuid|fallback-random>`

## Integrated into LLM runtime
- Updated `layers/content/server/utils/llm-translations-run.ts`:
  - Added optional `logContext` input to `runLocaleTranslation`.
  - Added `persistLog(...)` helper around each run.
  - Logs are now persisted for:
    - provider HTTP errors (`provider_error`)
    - invalid/empty provider content (`response_error`)
    - successful translations (`success`)

## Added API context
- Updated `layers/content/server/api/content/llm-translations/translate.post.ts`:
  - Passes `logContext` to each locale translation run with:
    - `path`, `scopeMode`, `scopePointer`, `overwriteMode`
    - `sourceEntryCount`, `eligibleEntryCount`

## Failure behavior
- If CouchDB log persistence fails, it is swallowed with a server warning and does not break translation execution.

# Proposed Next Steps
1. Add a small admin API endpoint to query recent `llm-translation-log` docs with filters (`status`, `locale`, `path`, date range).
2. Add optional redaction controls for sensitive translation inputs before persistence if needed.
