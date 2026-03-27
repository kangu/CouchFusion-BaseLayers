# Initial Prompt
Analyse the current project state thoroughly considering all aspects involved , review the past work from /docs folders and prepare to implement work on features.

# Plan
1. Review the content layer documentation history, emphasizing the latest implementation logs and status summaries.
2. Inspect the current source layout to identify the active product surfaces in the layer.
3. Cross-check recent layer changes against the shared conventions requested in the workspace instructions.
4. Produce a concise readiness brief focused on strengths, active change zones, and safe next feature slices.

# Implementation Summary
## Baseline
- Target layer: `layers/content`.
- The layer currently provides four major surfaces:
  - runtime content rendering
  - admin content workbench
  - builder/node editor
  - inline preview and translation tooling

## Current source shape
- Key admin/editor files:
  - `app/components/admin/ContentAdminWorkbench.vue`
  - `app/components/admin/ContentImageField.vue`
  - `app/components/admin/ContentRichTextField.vue`
  - `app/components/builder/**`
  - `app/components/inline/InlineLiveEditor.vue`
- Key supporting primitives:
  - `app/stores/pages.ts`
  - `app/composables/useContentPage*.ts`
  - `app/composables/useContentLiveUpdates.ts`
  - `app/composables/useLlmTranslations.ts`
  - `app/utils/locales-meta.ts`
  - `app/middleware/content.global.ts`

## Docs review conclusions
- Historical docs show the layer has already matured past basic page CRUD and builder scaffolding.
- The most active recent themes are:
  - inline preview click-to-focus reliability
  - shared locale metadata and inline SVG flags
  - LLM-assisted translation workflows
  - image field ergonomics
  - rich-text editor readiness/race-condition fixes
- The current code matches those themes:
  - `ContentAdminWorkbench.vue` now centralizes locale-aware editing, translation dialogs, staged locale documents, and builder coordination
  - `useContentLiveUpdates.ts` contains non-trivial iframe messaging, focus syncing, follow-link gesture logic, and click recovery logic
  - `locales-meta.ts` implements the shared inline-flag contract requested at workspace level

## Layer strengths
- Strong shared abstraction surface already exists for consumer apps:
  - runtime rendering
  - content page loading/cache
  - builder registration
  - locale metadata resolution
  - translation orchestration
- The layer is positioned well for more app adoption because it keeps both runtime and admin concerns in one reusable package.
- Documentation coverage is broad enough to understand feature intent without reverse-engineering everything from source.

## Main risks
- Complexity is concentrated in a few orchestration files:
  - `ContentAdminWorkbench.vue`
  - `useContentLiveUpdates.ts`
  - rich-text and image field components
- These files now carry multiple responsibilities, so new feature work there has elevated regression risk.
- The docs show many behavior fixes landed through iterative patching; that usually means edge cases are real, especially around:
  - iframe messaging timing
  - nested prop targeting
  - locale staging/persistence
  - lazy editor initialization
- Layer-local automated coverage was not reviewed in depth during this pass, so any claims of stability should still be validated feature-by-feature.

## Alignment with workspace standards
- Shared locale metadata and inline flags are correctly centered in:
  - `layers/content/app/utils/locales-meta.ts`
  - `layers/content/app/assets/flags/*.svg`
- This aligns with the workspace rule that consumer apps import the shared registry instead of duplicating locale definitions.
- The layer also appears to be the correct place to keep future locale coverage checks and builder metadata conventions.

## Best next feature slices
1. Favor additive improvements around existing editor primitives rather than broad rewrites.
2. Any work touching inline preview should preserve the current focus/click contract and validate nested markers explicitly.
3. Any work touching translations should keep the existing staged-edit model and avoid auto-save surprises.
4. If builder ergonomics are next, isolate improvements to focused subcomponents rather than growing `ContentAdminWorkbench.vue` further.

# Next Steps
1. Choose whether the next feature uses the layer as:
   - a consumer-facing runtime enhancement,
   - an admin/builder enhancement,
   - or a translation/localization enhancement.
2. Before implementation, define the exact slice so work stays narrow around the highest-risk orchestration files.
