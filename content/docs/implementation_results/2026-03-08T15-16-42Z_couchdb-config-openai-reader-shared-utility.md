# Initial Prompt
Proceed with CouchDB `_config` env rollout and reuse the same read pattern already used for `cf_openai.api_key`.

# Implementation Summary
Refactored LLM translations OpenAI key loading to use the shared database-layer `_config` helper instead of a local ad-hoc parser/reader.

# Documentation Overview
- Updated `layers/content/server/utils/llm-translations-config.ts`:
  - reads `cf_openai/api_key` via `readCouchConfigValue(...)` from `#database/utils/couch-config`
  - preserves existing fallback and error behavior.

