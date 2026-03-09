# Node editor batch translation selection checkboxes

## Scope
- Added a checkbox next to each field-level translate action in the Node Editor UI.
- Added a checkbox next to SEO title/SEO description translate actions in builder SEO settings.
- Top-level `Translate` now runs against selected fields when selections exist.
- Selection state persists across locale switches and resets when switching page path.

## UI changes
- New shared inline control component:
  - `app/components/builder/node-editor/NodeTranslateInline.vue`
  - Renders checkbox + existing `Translate` button.
- Replaced field-level translate button usages with `NodeTranslateInline` in:
  - `NodePropsPanel.vue`
  - `NodeObjectField.vue`
  - `NodeArrayItem.vue`
- Propagated selection callbacks through:
  - `NodeEditor.vue`
  - `NodePropsPanel.vue`
  - `NodeArrayField.vue`
  - `NodeArrayItem.vue`
  - `NodeObjectField.vue`
- Added styles for inline checkbox + button layout in `NodeEditor.vue`.

## Builder workbench wiring
- `Workbench.vue` now accepts and emits selected translation pointers:
  - prop: `selectedTranslationPointers`
  - event: `update:selectedTranslationPointers`
- Field pointer selection is resolved centrally in `Workbench.vue` from `{ uid, propPath }`.
- SEO selection checkboxes are available next to SEO translate buttons.

## Admin workbench integration
- `ContentAdminWorkbench.vue` now stores selected pointers in parent state.
- Passed pointer state into `BuilderWorkbench` and listens for updates.
- Top `Translate` action includes `selectedScopePointers` when non-empty.
- Selection is reset on page change, retained across locale changes.

## Server/API changes
- `translate.post.ts` accepts optional `selectedScopePointers`.
- Source entries are filtered to selected pointers (including descendants) when provided.
- Existing behavior remains unchanged when no pointers are selected.
- `totalSourceEntries` reflects the filtered set used for the run.

## Composable changes
- `useLlmTranslations.ts` request type now includes optional `selectedScopePointers`.

## Validation
- `bunx vitest --config vitest.config.ts content/tests/llm-translations-seo.spec.ts content/tests/builder/node-editor-dialogs.spec.ts content/tests/builder/node-editor-search.spec.ts --run`
- Passed.
