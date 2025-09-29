# Proper JSON Props Update

## Initial Prompt
Implement the specs in layers/content/docs/specs/proper_json_props.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Refined the builder so `json` props are parsed into structured data on load, edited via a validated JSON textarea, and saved back as objects/arrays instead of stringified blobs.

## Documentation Overview
- Workbench deserialisation now normalises JSON props using component schemas (`layers/content/app/components/builder/Workbench.vue`), converting any legacy strings into proper arrays.
- Node editor introduces a monospace JSON editor with inline validation (`layers/content/app/components/builder/NodeEditor.vue`), defaulting empty values to `[]` and preventing invalid payloads from overwriting data.
- Spec `proper_json_props.md` tracks the completed investigation, normalisation, and UI improvements with ✅ statuses for quick reference.

## Implementation Examples
- JSON normaliser during deserialisation: `layers/content/app/components/builder/Workbench.vue:44`
- Builder textarea/editor with validation: `layers/content/app/components/builder/NodeEditor.vue:23`
- Updated spec checkpoints: `layers/content/docs/specs/proper_json_props.md:1`
