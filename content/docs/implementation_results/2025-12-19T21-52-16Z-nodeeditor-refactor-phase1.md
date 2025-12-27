# NodeEditor Refactor Phase 1

## Initial prompt
Implement the specs in content/docs/2025-12-19T20-46-41Z-nodeeditor-refactor-plan.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time. 
Ask me for anything that after evalulation, you are not so sure what decision to make. Strive for minimal impact on other areas of the applicaiton. Any time your confidence for taking an actions is < 98%, ask for clarification. Present implementation plan before proceeding on my instructions.
1. Yes, include for extra props. 2. Continue into next sections until phase 1 is done and tests are passing.

## Implementation Summary
Implementation Summary: Extracted NodeEditor search highlight and field visibility helpers into local composables, introduced NodeTextField/NodeTextareaField for top-level and extra prop inputs, adjusted NodeEditor scoped styles with :deep() for child components, updated the refactor plan status, and confirmed bunx vitest passes from /layers.

## Documentation Overview
- Added composables under `layers/content/app/components/builder/node-editor/composables/` for search highlight and field visibility logic.
- Introduced `NodeTextField.vue` and `NodeTextareaField.vue` under `layers/content/app/components/builder/node-editor/` and wired them into top-level props and extra props in `NodeEditor.vue`.
- Updated scoped styles in `layers/content/app/components/builder/NodeEditor.vue` to use `:deep()` for input-related classes so child components remain styled.
- Marked Phase 1 steps complete in `layers/content/docs/2025-12-19T20-46-41Z-nodeeditor-refactor-plan.md`.

## Implementation Examples
```vue
<NodeTextField
  v-model="propDraft[prop.key]"
  :input-type="prop.type === 'number' ? 'number' : 'text'"
  :show-highlight="shouldHighlightText(propDraft[prop.key], prop.type)"
  :highlight-markup="getHighlightMarkup(propDraft[prop.key])"
  @input="() => schedulePropUpdate(prop.key, propDraft[prop.key], prop.type)"
  @blur="() => flushPropUpdate(prop.key, propDraft[prop.key], prop.type)"
/>
```
