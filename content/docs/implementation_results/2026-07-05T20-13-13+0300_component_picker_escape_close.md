# Component Picker Escape Close

## Summary
- Added Escape-key handling to `ComponentPickerDialog`.
- The listener is active while the picker is open, works when the dialog is initially mounted open, and is removed on close/unmount.
- Escape routes through the existing `close()` method, so search, selected category, preview device, manage mode, and expanded previews reset consistently.

## Verification
- Vue SFC compile check for `content/app/components/builder/ComponentPickerDialog.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the component picker is open before Escape and closed after Escape.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
