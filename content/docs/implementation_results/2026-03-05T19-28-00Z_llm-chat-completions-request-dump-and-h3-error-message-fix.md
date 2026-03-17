# LLM Chat Completions Request Dump + H3 Error Message Fix

## Changes
- Added full server-side logging of the `/chat/completions` request body before sending the request.
- Added server-side error logging for failed `/chat/completions` responses (status, statusText, responseText).
- Replaced long `statusMessage` usage in `createError` with:
  - short `statusMessage`
  - detailed `message`

## File
- `layers/content/server/utils/llm-translations-run.ts`

## Validation
- `bun run build` in `apps/radustanciu` completed successfully.
