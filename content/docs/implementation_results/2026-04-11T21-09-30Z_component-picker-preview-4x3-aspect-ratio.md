# Component Picker Preview Ratio: 4:3

## Scope
- Layer: `layers/content`
- File: `app/components/builder/ComponentPickerDialog.vue`

## Change
- Updated card preview container to a natural `4:3` ratio:
  - `aspect-ratio: 4 / 3`
  - removed fixed `height: 200px`
- Aligned desktop preview frame dimensions to 4:3:
  - desktop `PreviewFrame` now uses `1024x768`

## Notes
- Mobile preview dimensions remain unchanged in mobile mode.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
