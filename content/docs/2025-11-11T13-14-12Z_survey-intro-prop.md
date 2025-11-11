# Survey Intro Prop

## Initial Prompt
Refactor SurveyForm.vue to have a prop that maps further to stringarray called introParagraphs instead of the current computed property.

## Implementation Summary
SurveyForm now exposes an `introParagraphs` stringarray prop (with a matching `meta.introParagraphs` fallback), and the registry generator reflects those fields so editors can populate the intro copy directly from the builder.

## Documentation Overview
- Added `introParagraphs?: string[]` to the SurveyForm prop types and updated the `introParagraphs` computed to prefer the prop, then `meta.introParagraphs`, before falling back to the description split logic.
- Regenerated bitvocation’s component definitions so both the root SurveyForm prop list and nested meta fields include the `Intro Paragraphs` stringarray control recognized by the NodeEditor.
- No other components were affected; the change is localized to SurveyForm and the auto-generated registry output.

## Implementation Examples
- `apps/bitvocation/app/components/content/SurveyForm.vue:209-248 & 470-500` – SurveyComponentMetaProp + SurveyComponentProps now include `introParagraphs`, and the computed `introParagraphs` getter honors the new prop before using description text.
- `cli-content/generate-component-registry.mjs` (rerun) → `apps/bitvocation/app/content-builder/component-definitions.ts:1180-1225` shows the regenerated stringarray fields for `introParagraphs` under both the root props and the meta object.
