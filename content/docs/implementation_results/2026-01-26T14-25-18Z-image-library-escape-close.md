## Initial Prompt
Make the Select Image dialog close when pressing Esc.

## Plan
1. Add an Escape key handler to the image library overlay.
2. Ensure the overlay can receive focus so the keydown event fires reliably.
3. Keep existing click-to-close and upload behavior unchanged.

## Implementation Summary
- Added a focusable `data-image-library` backdrop with `@keydown.esc.prevent.stop="closeLibrary"` so pressing Esc closes the dialog.
- When the library opens, it now focuses the backdrop after render to ensure the Escape listener is active.
- Existing click-away and upload flows remain intact.

## Next Steps
- Smoke test: open the image picker, press Esc, confirm it closes; verify tab/shift+tab still move focus within the dialog.
