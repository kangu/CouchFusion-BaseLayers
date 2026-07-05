# Component Picker Compact Header

## Summary
- Compacted the Select Component dialog header controls.
- Changed `Manage Categories` to `Categories`, with `Picker` while in manage mode.
- Replaced visible `Desktop`/`Mobile` text with icon-only buttons using accessible `aria-label` and `title` text.
- Replaced visible `Updated`/`Name` sort labels with icon-only buttons using accessible labels.
- Removed the separate `Sort` label from the header.
- Made the thumbnails control smaller with a stacked `Thumbs` label/value and shorter range input.

## Verification
- Vue SFC compile check for `content/app/components/builder/ComponentPickerDialog.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the compact header renders with `Categories`, icon-only controls, and the smaller `Thumbs` selector.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
