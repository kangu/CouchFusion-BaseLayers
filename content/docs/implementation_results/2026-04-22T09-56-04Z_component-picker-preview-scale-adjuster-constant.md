# Component Picker Preview Scale Adjuster Constant

## Initial Prompt
I would like a bigger zoom overall. Implement a scale adjuster constant in the code which I can tune myself to get the right result.

## Plan
1. Add one global constant for preview zoom adjustment in `ComponentPickerDialog.vue`.
2. Apply it to both desktop and mobile dynamic preview scales.
3. Keep existing dynamic thumbnail-count scaling behavior intact.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Added tunable constant:
  - `PREVIEW_SCALE_ADJUSTER = 1.2`
- Applied it inside the dynamic interpolation function:
  - `baseScale * PREVIEW_SCALE_ADJUSTER`
- Added clamping safety:
  - min `0.08`, max `0.95`

## How To Tune
- Increase `PREVIEW_SCALE_ADJUSTER` (e.g. `1.3`) for larger preview zoom.
- Decrease it (e.g. `1.0` or `0.9`) for smaller preview zoom.

## Proposed Next Steps
1. Adjust `PREVIEW_SCALE_ADJUSTER` by small increments (`0.05`) until it matches your desired preview density.
