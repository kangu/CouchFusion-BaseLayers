# Builder Meta UI Override

## Initial Prompt
The value I put into Image7 Link is not persisted to the database after a save. Also, the svg element is not clickable.

## Implementation Summary
Implementation Summary: Extended the component registry generator to honor builderFieldMeta `ui` overrides so props can opt out of image widgets.

## Documentation Overview
- Allows builderFieldMeta to override UI metadata in generated schemas.
- Enables plain text inputs for props that were auto-detected as images.

## Implementation Examples

```js
if (Object.prototype.hasOwnProperty.call(payload, 'ui')) {
  normalizedPayload.ui = payload.ui
}
```
