# ContentImageField: ImageKit Zoom (`z`) Support

## Scope
- Layer: `content`
- File: `/Users/radu/Projects/nuxt-apps/layers/content/app/components/admin/ContentImageField.vue`

## Changes
- Added a new **Zoom** control in the ImageKit Adjustments panel.
- Zoom value is serialized as ImageKit transformation token: `z-<value>`.
- Zoom is parsed back from persisted transform strings so the control initializes from saved values.
- Reset action now clears zoom as well.
- Added helper text for zoom semantics in the UI:
  - `<1` zoom out
  - `>1` zoom in
  - intended for object/face focus use cases.

## Technical details
- New local state ref: `imageKitZoom`.
- Added decimal parser helper for positive numeric zoom values.
- Updated transform builder (`imageKitTransformString`) to include `z-*`.
- Updated transform parser (`parseImageKitTransformState`) to read `z` prefix.

## Validation
- Vue SFC parse/template compile check: `OK`.
