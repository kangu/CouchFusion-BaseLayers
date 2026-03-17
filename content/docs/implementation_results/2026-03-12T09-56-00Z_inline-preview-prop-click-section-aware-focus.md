# Inline preview prop click: section-aware focus routing

## Request
Use Playwright against `http://localhost:7833/k` and ensure clicking the iframe element with `data-prop-id="headlinePrefix"` expands the correct section and focuses the matching prop field in the node editor. Add section-level identification for robustness.

## Reproduction (Playwright)
- Loaded `http://localhost:7833/k`.
- Clicked `data-prop-id="headlinePrefix"` inside the preview iframe (`inline-preview=1`).
- Confirmed message payload and node editor behavior.

## Root cause
- The inline editor called `workbenchRef.value?.focusPropFromPreview?.(...)`, but in this runtime the method was exposed under `component.$.exposed.focusPropFromPreview`, so the direct call could no-op.

## Implementation
1. **Expose call fallback fix**
- Updated `InlineLiveEditor` to invoke `focusPropFromPreview` via:
  - direct proxy method (when available), or
  - `component.$.exposed.focusPropFromPreview` fallback.

2. **Section-aware marker propagation**
- Added runtime preview annotation of section id:
  - `data-section-id` is now serialized from `__builderSectionId` when preview UID annotation is enabled.
- On iframe click capture, payload now emits:
  - `uid`, `propPath`, and `sectionId` (when available).

3. **Section-aware focus resolution in workbench**
- `focusNodeProp` now accepts optional `sectionId`.
- If present, it resolves the matching root section by id and prefers that branch when uid/root mismatch exists.

## Files changed
- `layers/content/app/components/inline/InlineLiveEditor.vue`
- `layers/content/app/composables/useContentLiveUpdates.ts`
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/app/utils/contentBuilder.ts`

## Verification result
Playwright check after patch:
- Marker info: `uid=node-181`, `sectionId=sec_ea5eb0ef-96f0-4cfa-80ef-7d6a3ff243b5`
- Emitted message: `content_inline_prop_click` with `path`, `uid`, `propPath=headlinePrefix`, `sectionId`
- Builder result: section `Intro` panel expanded and active focused field path is `headlinePrefix`.
