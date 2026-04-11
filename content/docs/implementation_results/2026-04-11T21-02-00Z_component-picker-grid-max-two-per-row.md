# Component Picker Grid: Max Two Cards Per Row

## Scope
- Layer: `layers/content`
- File: `app/components/builder/ComponentPickerDialog.vue`

## Change
- Updated component picker grid layout to cap at **2 cards per row**:
  - `grid-template-columns: repeat(2, minmax(0, 1fr))`
- Added responsive fallback to 1 column under `1100px` viewport width.

## Outcome
- Larger preview cards on desktop for easier inspection.
- Consistent two-column maximum regardless of very wide screens.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.
