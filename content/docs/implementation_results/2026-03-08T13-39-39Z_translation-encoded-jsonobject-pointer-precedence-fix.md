# Translation: Encoded `:jsonobject` Pointer Precedence Fix

## Issue
Nested translated values (example: `signalSection.items[*].label`, `toolkitSection.items[*].tagline`) appeared in translation maps but were not reliably updated in the persisted encoded prop values (for example `:signalSection`, `:toolkitSection`).

Observed symptom:
- Saved docs contained mixed/stale data where plain mirror objects (`signalSection`, `toolkitSection`) got updated, while encoded source props (`:signalSection`, `:toolkitSection`) remained partially old.

## Root Cause
Pointer resolution favored direct object paths over encoded `:prop` JSON paths whenever both existed.

Because some docs contain both:
- direct mirror props: `signalSection`, `toolkitSection`
- encoded canonical props: `:signalSection`, `:toolkitSection`

translation apply could write to direct mirrors only, leaving encoded values stale.

## Fix
- Updated server translation pointer resolver to prefer encoded targets first:
  - `layers/content/server/utils/llm-translations-run.ts`
  - Added `resolveEncodedPointerTarget(...)` and made `resolvePointerTarget(...)` choose encoded first.
  - When encoded is updated, existing direct mirror paths are also synced to the same translated value.
- Updated shared save/i18n pointer resolver to prefer encoded targets first:
  - `layers/content/server/utils/content-i18n.ts`
  - Added `resolveEncodedBodyPointerTarget(...)` and made `resolveBodyPointerTarget(...)` choose encoded first.
  - When encoded is updated, existing direct mirror paths are also synced.
- Updated admin translation draft apply to write through encoded `:prop` paths when available:
  - `layers/content/app/components/admin/ContentAdminWorkbench.vue`
  - `setBodyPointerStringValue(...)` now resolves encoded write targets and updates serialized JSON payloads.
  - Existing direct mirror paths are synced in-place when present.

## Expected Behavior
- Pointers like `/1/1/signalSection/items/2/label` now persist into `:signalSection` consistently.
- Pointers like `/1/1/toolkitSection/items/5/tagline` now persist into `:toolkitSection` consistently.
- Translation report values and final saved document structure should now match.
