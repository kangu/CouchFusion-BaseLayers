# Translation Persist Fix: Stale Fixed Path Metadata

## Problem
- Persisting a staged translated locale could keep certain translated values unchanged.
- Root cause: staged locale docs could carry stale `meta.contentI18n.fixedBodyPaths`, causing save-time fixed-path merge to overwrite translated values from master.

## Fix
- `content/server/api/content/llm-translations/translate.post.ts`
  - Added `withResolvedFixedBodyPaths(...)` to normalize staged document metadata.
  - Each staged locale document now gets `meta.contentI18n.fixedBodyPaths` set to the resolved fixed-path set used by the translation run.

## Impact
- Persist now uses consistent fixed-path metadata between translate and save phases.
- Prevents stale target-locale metadata from reverting translated fields during persist.

## Validation
- `bun run build` from `apps/radustanciu` passed (SSR build successful).
