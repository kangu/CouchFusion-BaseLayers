# Component Picker: Taller Mobile Cards/Previews

## Scope
- Layer: `layers/content`
- File: `app/components/builder/ComponentPickerDialog.vue`

## Change
- Increased vertical shape of cards and inline previews in mobile mode by applying a portrait ratio:
  - `.component-picker-grid.is-mobile-grid .component-card-preview { aspect-ratio: 9 / 16; }`

## Outcome
- In mobile preview mode, cards are visibly taller and better match phone screen proportions.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
