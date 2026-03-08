# Translation Apply: Missing Leaf Keys

## Request
Investigate why translated `work.description` / `work.detailed` values were present in LLM output but missing from staged/persisted target locale payload.

## Root Cause
- Translation apply logic only resolved pointers when the target value already existed.
- For pointers like `/2/1/description` and `/2/1/detailed`, if the locale document did not yet have those keys on the target object, pointer resolution returned `null`, so updates were skipped.
- This is independent of Tiptap/editor UI. The issue is in pointer-apply semantics on the server (and mirrored client draft apply behavior).

## Changes
- Updated `layers/content/server/utils/llm-translations-run.ts`:
  - `resolvePointerTarget(...)` now supports direct object leaf creation when parent path exists but leaf key is missing.
  - Encoded `:jsonobject` pointer resolution no longer requires nested leaf value to already exist.
- Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue`:
  - `setBodyPointerStringValue(...)` now allows writing missing object leaf keys during staged inline edits.

## Expected Result
- If LLM returns translations for existing object paths whose leaf keys are missing in target locale docs, those keys are now created and persisted.
- `description` and `detailed` translations should now appear in staged debug target body and final saved payload at the expected pointers.
