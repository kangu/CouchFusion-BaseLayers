# Initial Prompt
Optimize translation payload so only translatable texts are sent to LLM, using minimal fields (`index`, `source_translation`, `target_translation`), then consolidate translations back to exact body positions. Structural strings like component names (for example `work`) must never be translated.

# Plan
1. Refactor translatable-entry collection to skip minimark structural strings and technical metadata values.
2. Change LLM request/response contract from `id/text` to pointer-indexed `index/source_translation/target_translation`.
3. Filter entries per target locale before LLM call based on overwrite mode and current target values.
4. Keep pointer-based consolidation when applying translated results back into target body.
5. Preserve current reporting format while reflecting skipped entries from pre-filtering.

# Implementation Summary
## 1) Structural minimark strings are no longer included
Updated `server/utils/llm-translations-run.ts`:
- Replaced generic deep string crawl with minimark-aware traversal.
- Component/tag identifiers at array index `0` are now excluded.
- Technical prop keys are excluded (`__builder*`, `__content*`, `v-slot:*`, and non-copy structural keys like class/style/id).
- String collection now focuses on meaningful text-bearing values and deduplicates pointers.

Result: values like `"work"`, `"template"`, `"p"`, section IDs, and slot markers are no longer sent to LLM.

## 2) Minimal pointer-index payload contract
Updated `server/utils/llm-translations-run.ts` prompt + parsing:
- Request items now use:
  - `index` (body pointer)
  - `source_translation`
  - `target_translation`
- Output contract now expects:
  - `index`
  - `target_translation`
- Response parsing maps by `index` directly to `translationsByPointer`.

## 3) Locale-specific pre-filtering before LLM call
Updated `server/api/content/llm-translations/translate.post.ts`:
- For each target locale, compute `eligibleEntries` from source pointers by reading current target value at same pointer.
- In `overwriteMode: "missing"`, only entries with missing target values are sent to LLM.
- In `overwriteMode: "all"`, all eligible translatable entries are sent.

Result: fewer tokens, fewer unnecessary model operations, and no "translated but skipped" waste for non-missing targets.

## 4) Consolidation back to target body remains pointer-based
No behavior regression for apply:
- Translations are still applied via pointer paths to exact target-body positions.
- Report skipped counts now include both:
  - apply-time skips
  - pre-filtered non-eligible entries.

# Files Changed
- `layers/content/server/utils/llm-translations-run.ts`
- `layers/content/server/api/content/llm-translations/translate.post.ts`

# Next Steps
1. Re-run the same translation scenario and inspect the dumped `/chat/completions` body; structural tokens should be absent.
2. Verify that in `missing` mode, request items only include pointers missing in target locale.
3. If desired, add a small server-side test fixture for minimark traversal to lock this behavior.
