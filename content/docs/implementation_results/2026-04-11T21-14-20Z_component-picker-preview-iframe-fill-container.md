# Component Picker Previews: Iframe Fill Behavior

## Scope
- Layer: `layers/content`
- File: `app/components/builder/ComponentPickerDialog.vue`

## Problem
- Embedded preview iframes rendered at fixed scaled dimensions and did not occupy full card preview area, leaving large blank space.

## Change
- Replaced fixed-size scaled preview wrapper with full-fill sizing in card previews.
- Card preview now uses:
  - `PreviewFrame width="100%" height="100%"`
  - CSS deep override so `.preview-frame-container` and `.preview-iframe` fill parent (`100% x 100%`).
- Removed old `.preview-scaler` transform-based approach from picker cards.

## Outcome
- Embedded preview iframes now render full width and full height inside the preview container.

## Verification
- `cd apps/nuxt-app-starter && npx nuxi prepare` passed.

## Follow-up: Desktop media-query fidelity
- Desktop card previews now use a 4x internal viewport scaled down to 25% (`.preview-scaler.is-desktop`).
- This keeps previews visually fitting the container while forcing desktop breakpoints/media queries inside iframe content.
