# Content Layer Page Adjust

## Initial Prompt
```
Implement the specs in docs/specs/page_adjust. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.
```

## Plan
1. Add a progress checklist to `docs/specs/page_adjust.md` to track refactor milestones.
2. Update `useContentPagesStore` so summaries normalise documents into the requested structure and expose them consistently.
3. Adjust consuming code (admin content page) to rely on the normalised document payload, then document the change.

## Implementation Summary
- `useContentPagesStore` now normalises CouchDB responses into documents shaped like the spec example, capturing `_id`, layout spacing, minimal body arrays, and SEO data (`layers/content/app/stores/pages.ts`).
- Page summaries expose the normalised `document` alongside derived SEO/title metadata so downstream consumers can rely on a single canonical structure.
- The Bitvocation admin content page now consumes the normalised document directly, simplifying builder hydration logic (`apps/bitvocation-demo/pages/admin/content.vue`).

## Documentation Overview
- Spec checklist in `layers/content/docs/specs/page_adjust.md` updated to reflect completion, including the new save workflow and metadata tasks.
- Added this log to capture the refactor details for future reference.

## Manual Verification
1. With the dev server running, visit `/admin/content` and ensure the page list populates.
2. Select an existing page and confirm the builder loads the document without console warnings.
3. Create a new page and verify it appears in the selector with the expected metadata defaults.
