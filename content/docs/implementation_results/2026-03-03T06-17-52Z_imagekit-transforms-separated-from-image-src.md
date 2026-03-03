# ImageKit transforms stored separately from image source

## Summary
Refactored image editing flow so image transformations are persisted separately from the base image source value.

## Content layer changes

### `ContentImageField.vue`
- Added `transformValue` input and `update:transformValue` emit.
- Kept `modelValue` as transform-free source (ImageKit `tr:` segment is stripped).
- Added legacy migration behavior:
  - if incoming `modelValue` contains `tr:...`, transforms are extracted and emitted via `update:transformValue`.
- ImageKit controls now update only `transformValue`.
- Main `modelValue` is no longer rewritten when transform controls change.
- Clearing image now clears both image value and transform companion value.

### Node editor wiring
- `NodePropsPanel.vue`, `NodeObjectField.vue`, `NodeArrayItem.vue` now pass and persist companion transform values using key convention:
  - `<imageKey>ImagekitTransforms`
- Added handling for custom image field transform events in:
  - top-level props
  - object fields
  - array item fields
  - nested array/object structures in node array editor

### String array alignment safety
- `NodeEditor.vue` now mirrors top-level string-array remove/reorder operations to companion transform arrays (`<key>ImagekitTransforms`) so per-image transforms stay index-aligned.

## Behavior outcome
- Source image props remain clean (no inline transformations).
- Transform settings persist per image in dedicated companion props.
- Live preview/editor can consume source + transforms separately.
