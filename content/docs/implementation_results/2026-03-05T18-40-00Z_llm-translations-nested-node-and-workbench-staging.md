# LLM Translations: Nested Field Actions + Workbench Staging

## Scope
- Completed nested inline translation trigger support in builder node editor.
- Connected `translate-scope` events from Builder Workbench into Content Admin Workbench.
- Added admin controls for target locales, overwrite mode, and page-level translation.
- Added staged translation report + quick-open locale actions.
- Kept Save flow manual per locale (staged docs are not auto-saved).

## Files Updated
- `layers/content/app/components/builder/node-editor/NodePropsPanel.vue`
- `layers/content/app/components/builder/node-editor/NodeObjectField.vue`
- `layers/content/app/components/builder/node-editor/NodeArrayField.vue`
- `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`
- `layers/content/app/components/builder/NodeEditor.vue`
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- `layers/content/docs/llm_translations.md`

## Key Implementation Notes
- Fixed broken compile patch in `NodePropsPanel` and re-enabled field translation callback dispatch.
- Added nested path-aware translation callbacks for `jsonobject` / `jsonarray` / `stringarray` branches.
- Added inline translation buttons for localized text/textarea/rich-text fields at nested depths.
- Added shared inline control styles for row-aligned translate buttons.
- Added translation controls in admin header:
  - locale targets (multi-select checkboxes)
  - overwrite mode (`missing` / `all`)
  - page translation action
- Added translation report rendering with locale status and quick-open buttons.
- Added per-locale staged document handling in admin workbench:
  - staged docs override loaded page document for active locale
  - staged docs persist during locale switching for the same page
  - switching to another page clears staged docs
  - saving current locale removes that locale from staged map

## Validation
- Command: `bun run build`
- Workdir: `apps/radustanciu`
- Result: success (client + server build OK)
- Notes: existing Tailwind sourcemap warnings remain unchanged.
