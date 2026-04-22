# Component Picker Mobile Responsive Viewport Clamp

## Initial Prompt
That's good and it works for Desktop view, but not for Mobile. On Mobile, I expect to see the appropriately zoomed mobile responsive version of the components.

## Plan
1. Keep desktop logic unchanged.
2. Constrain mobile virtual viewport to a mobile-only width band.
3. Apply this as a scale clamp in the mobile preview scaler CSS.

## Implementation Summary
Updated `layers/content/app/components/builder/ComponentPickerDialog.vue`:
- Added mobile viewport bounds:
  - `MOBILE_PREVIEW_MIN_VIEWPORT_WIDTH = 360`
  - `MOBILE_PREVIEW_MAX_VIEWPORT_WIDTH = 480`
- Exposed `--component-picker-preview-mobile-max-width` CSS variable in grid style binding.
- Reworked mobile effective scale calculation:
  - `fit-min` = scale floor needed so virtual viewport does not exceed max mobile width.
  - `fit-max` = scale ceiling to avoid over-zooming below min mobile width.
  - effective mobile scale now clamps dynamic scale between those two limits.

## Result
Mobile preview now stays within a mobile-responsive viewport range and displays the appropriate mobile version of components, even as thumbnail density changes.

## Proposed Next Steps
1. Validate mobile preview at low and high thumbnail counts (2 and 10) to confirm consistent mobile breakpoints.
2. Fine-tune `360/480` bounds if you want narrower or wider mobile simulation.
