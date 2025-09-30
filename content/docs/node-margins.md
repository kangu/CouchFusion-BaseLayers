# Node Margins Support

## Initial Prompt
Implement the specs in layers/content/docs/specs/margin_for_all_elements.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 80%, ask for clarification.

## Implementation Summary
Added margin controls for builder nodes, serializing them through a wrapper component so ContentRenderer applies optional spacing.

## Documentation Overview
- Builder nodes now expose a dedicated margins section that edits per-side spacing without cluttering component props.
- Serialization wraps components with `content-margin-wrapper`, which applies Tailwind margin classes at render time and is hidden from the component palette.
- Deserialization detects the wrapper and restores the margin configuration so existing pages round-trip cleanly.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:360` – renders the margins UI and mutates the node’s stored margin configuration.
- `layers/content/app/utils/contentBuilder.ts:58` – wraps serialized components with the margin wrapper and rebuilds Tailwind classes from stored margins.
- `layers/content/app/components/runtime/ContentMarginWrapper.vue:1` – simple runtime component that forwards children while applying the computed margin classes.
