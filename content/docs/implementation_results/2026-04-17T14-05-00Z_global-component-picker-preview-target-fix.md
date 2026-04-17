# Fix: Global Component Preview in Select Component Dialog

## Issue
Global aliases in the Select Component dialog rendered blank previews.

## Root cause
The picker preview rendered `<component :is="comp.id">`. For global entries, `comp.id` is the alias id (e.g. `GlobalFooter`), not a registered Vue component name.

## Implemented fix
- Added preview metadata on component definitions:
  - `previewComponentId?: string`
  - `previewProps?: Record<string, BuilderValue>`
- Global alias definitions now expose:
  - `previewComponentId = entry.component` (real target component id)
  - `previewProps = entry.defaultProps` (so preview reflects global defaults)
- Component picker preview rendering now resolves component id via `getPreviewComponentId(def)` and falls back to `def.id`.
- Picker props for preview now merge schema defaults with `previewProps` overrides.

## Result
Global components in the picker render their target component correctly and use configured global default props, including expanded preview mode.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/app/types/builder.ts`
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/app/components/builder/ComponentPickerDialog.vue`
