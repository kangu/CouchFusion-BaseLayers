# LLM Success Response Console Logging

## Scope
- Log successful `/chat/completions` response payloads for translation calls.

## Changes
- `content/server/utils/llm-translations-run.ts`
  - Added server log after successful response JSON parse:
    - `[content][llm-translations] /chat/completions success response: ...`
  - Payload is printed as pretty JSON for easier inspection.

## Validation
- `bun run build` from `apps/radustanciu` passed.
