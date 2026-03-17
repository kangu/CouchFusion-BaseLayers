# Inline preview image prop click opens image library

## Request
When a clicked `data-prop-id` in inline preview belongs to an image prop, replicate the image click behavior in NodeEditor so the image select dialog opens.

## Implementation
1. Added an explicit image-open trigger marker in the image field UI:
- `layers/content/app/components/admin/ContentImageField.vue`
- Added `data-image-field-open-library="true"` on the preview button that opens the media library.

2. Updated NodeEditor prop focus behavior:
- `layers/content/app/components/builder/NodeEditor.vue`
- In `focusPropInput(...)`, after locating `[data-content-prop-path="..."]` and scrolling it into view:
  - first tries to find `[data-image-field-open-library]` and clicks it (if enabled), then returns;
  - otherwise falls back to existing input/textarea/rich-text focus logic.
- Added a small helper to check disabled state across button/input/textarea/aria-disabled controls.

## Validation
Playwright validation on `http://localhost:7833/k`:
- Triggered click on preview marker `data-prop-id="profileImage"`.
- Confirmed target panel (Intro) expanded.
- Confirmed `profileImage` field resolved.
- Confirmed image library backdrop opened (`.image-field__library-backdrop[data-image-library]`).

## Notes
- Text/rich-field behavior remains unchanged.
- This works for any image prop rendered via `ContentImageField` because the focus routine now detects and clicks the field’s explicit open-library trigger.
