# Component Picker Preview Fill Parent Width

## Initial Prompt
Inside the preview iframes, the component should span the entire width available from its parent container.

## Plan
1. Keep scope limited to `ComponentPickerDialog.vue` preview rendering.
2. Apply a dedicated class to previewed components in both card and expanded preview iframes.
3. Enforce width filling through scoped `:deep(...)` selectors without changing runtime content components.

## Implementation Summary
- Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
  - Added class `component-picker-preview-fill-target` to the `<component ...>` rendered inside:
    - thumbnail preview iframe cards,
    - expanded preview iframe.
  - Added scoped `:deep(...)` CSS rules to force preview component root width:
    - `width: 100% !important;`
    - `max-width: 100% !important;`
- Existing desktop/mobile aspect-ratio behavior remains unchanged.

## Result
Previewed components now expand to the full width available from their iframe parent container in both grid thumbnails and expanded modal previews.

## Proposed Next Steps
1. Manually verify a few components in Select Component dialog for both Desktop and Mobile preview modes.
