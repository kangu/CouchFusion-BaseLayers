# ContentImageField ImageKit panel collapsed by default

## Summary
Updated the ImageKit Adjustments panel in `ContentImageField.vue` to start collapsed and expand only when toggled by click.

## Changes
- Added local state: `isImageKitPanelOpen` (default `false`).
- Added a header toggle button with `aria-expanded`.
- Kept the panel container visible for ImageKit sources, but gated panel content behind `v-if="isImageKitPanelOpen"`.
- Added lightweight styles for the new toggle trigger text.

## Result
ImageKit adjustments are now hidden by default and shown only after explicit user interaction.
