# Inserted Section Preview Scroll

## Initial Prompt

After a section is inserted and available in the page, the live preview should scroll to that section's top so users can start editing it.

## Plan

1. Trace the existing Workbench to inline-preview focus bridge.
2. Add a regression test for post-insert focus and top-aligned preview scrolling.
3. Queue the inserted section's node UID during placement insertion.
4. Emit the focus request only after the debounced preview document update is emitted.
5. Extend the preview focus payload to support forced top alignment without changing normal focus behavior.
6. Verify with the focused tests, full builder suite, and authenticated browser load.

## Implementation Summary

- Added `pendingInsertedSectionFocus` in `Workbench.vue`.
- `confirmRootSectionPlacement()` now queues the newly created root node UID after insertion.
- `schedulePreviewDocumentEmit()` flushes the queued focus immediately after emitting `document-preview-change`, so the iframe receives `live_updates` before the focus message.
- Extended Workbench, `ContentAdminWorkbench`, and `InlineLiveEditor` node-focus payloads with `scrollBlock` and `forceScroll`.
- Updated `useContentLiveUpdates()` so forced focus messages scroll with the requested `ScrollLogicalPosition`.
- Inserted sections use `scrollBlock: "start"` and `forceScroll: true`; existing preview focus behavior remains centered and visibility-gated.

## Verification

Executed from `/Users/radu/Projects/nuxt-apps/layers`:

```bash
bunx vitest --config vitest.config.ts content/tests/builder/section-placement-workflow.spec.ts content/tests/builder/section-placement-preview-scroll.spec.ts --run
bunx vitest --config vitest.config.ts content/tests/builder --run
```

Result:

- Focused section placement scroll tests passed.
- Full builder suite passed: 15 test files, 47 tests.

Authenticated browser reload of `http://localhost:3012/k/about` rendered the builder workbench without new console errors from the scroll-focus wiring.

## Remaining Console Items

- Existing Nuxt warning about client-side access to non-public `runtimeConfig.content`.
- Existing 404 for `/api/content/pages?path=%2Fdashboard&locale=en`.
- One aborted ImageKit avatar request.
