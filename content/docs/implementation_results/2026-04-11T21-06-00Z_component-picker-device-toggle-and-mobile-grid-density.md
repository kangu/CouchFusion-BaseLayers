# Component Picker: Device Toggle + Grid Density

## Scope
- Layer: `layers/content`
- File: `app/components/builder/ComponentPickerDialog.vue`

## Changes
- Desktop preview is now the default mode in the Select Component dialog.
- Added a header toggle (upper-right area) for `Desktop` / `Mobile` preview mode.
- Main card preview now renders a single device preview (instead of showing both desktop and mobile at once).

## Grid behavior
- Desktop mode: max 2 columns.
- Mobile mode: 4 columns on wide viewports, with responsive fallback on smaller widths.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
