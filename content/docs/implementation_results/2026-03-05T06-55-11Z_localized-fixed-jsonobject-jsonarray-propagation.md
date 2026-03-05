# Localized Save Propagation for Fixed JSON Object/Array Fields

Date: 2026-03-05

## Issue
- On localized page saves, updates inside non-localized fields nested in `jsonobject` / `jsonarray` structures (example: `Landing.primaryButton.label`) did not always propagate to sibling locale documents.

## Root Cause
- Save flow primarily trusted `master` `fixedBodyPaths` and only used incoming `fixedBodyPaths` when master paths were empty.
- If master metadata had a stale/incomplete fixed path set, nested fixed-field changes could be skipped during write-through/propagation.

## Standardized Handling
- Canonical fixed-path set is now:
  - `fixedBodyPaths = sort(unique(master.fixedBodyPaths ∪ incoming.fixedBodyPaths))`
- Apply this on both:
  - default locale saves
  - non-default locale saves
- Treat fixed-path set changes as metadata changes that must be persisted on master.

This gives one consistent rule across `jsonobject` and `jsonarray` structures: propagation is based on the merged canonical path set available at save time, not only on legacy master metadata.

## Implementation
- Updated `content/server/utils/content-pages-save.ts`:
  - added `mergeFixedBodyPaths(...)`
  - switched fixed-path resolution in both save branches to merged canonical set
  - updated master-metadata refresh condition to also trigger when canonical fixed paths differ from persisted master paths

## Validation
- `bun run build` in `apps/radustanciu` passed (SSR/client build successful).
