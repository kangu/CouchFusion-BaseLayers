# Translation report modal stacking and viewport scroll

## Summary
Updated the translation result dialog so it consistently overlays the pinned editor header/actions panel and stays within viewport height with internal scrolling.

## Files changed
- `layers/content/app/components/admin/ContentAdminWorkbench.vue`

## Implementation details
1. Raised modal stacking level:
- `.content-admin-workbench__modal` z-index changed from `50` to `2100`.
- This places both the backdrop and dialog above the fixed save/actions header (`z-index: 1000`).

2. Added a dedicated translation report dialog layout class:
- Translation report panel now uses `modal__panel--translation-results`.
- Applied viewport cap and internal layout rows:
  - `max-height: min(calc(100dvh - 1rem), 100%)` (with `vh` fallback)
  - `grid-template-rows: auto minmax(0, 1fr) auto`
  - `overflow: hidden`

3. Added scrollable body container for report content:
- Wrapped notice/progress/report content in `.translation-modal__body`.
- Set:
  - `min-height: 0`
  - `overflow-y: auto`
- Keeps header and footer actions visible while the long report content scrolls internally.

## Expected behavior
- Translation report dialog always appears in front of the fixed save panel.
- Backdrop dark overlay also covers the save panel.
- Dialog height is constrained to viewport and long content scrolls inside the dialog body.
