# Initial Prompt
I have updated the type of "description" from SurveyComponentSectionProp (in SurveyForm.vue) to RichTextAreaString, yet when I run the cli-content/generate-component-registry.mjs the component definition it generates for that is still type: 'text'. Investigate why and fix. Allow for rich text definitions to be supplied at any level in the node hierarchy. Also make sure the NodeEditor renderer correctly renders the ui widget.

# Plan
1. Trace how the CLI generator converts TypeScript props into registry schemas to find where UI hints (e.g. RichTextAreaString) are dropped for nested fields.
2. Patch the generator so `ui` metadata is propagated through nested object/array schemas, merge helpers preserve it, and rerun the registry build for validation.
3. Ensure the NodeEditor respects those hints even for legacy definitions by normalizing textarea/rich-text widgets before rendering controls.

# Implementation Summary
Updated the registry generator to carry RichText UI metadata into nested schemas, regenerated bitvocation's component definitions, and normalized NodeEditor definitions so textarea/rich-text widgets render properly throughout the builder.

# Next Steps
- Backfill regression tests around `applySchemaUiHints` so future schema changes cannot strip widget metadata.
- Evaluate whether other widget types (e.g. select, image) need similar normalization logic inside the builder.

# Documentation Overview
- Captured how UI hints now flow end-to-end (generator → registry output → NodeEditor rendering) to guide future component or CLI enhancements.

# Implementation Examples
- `cli-content/generate-component-registry.mjs`: New `applySchemaUiHints` ensures nested fields inherit rich-text widgets and merge helpers retain `ui` objects.
- `layers/content/app/components/builder/NodeEditor.vue`: Added a normalization pass that translates textarea widgets into textarea controls even for pre-existing definitions.
