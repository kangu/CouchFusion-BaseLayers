# Image Array Field Support

## Initial Prompt
I have added the "logos" string to IMAGE_FIELD_KEYWORDS inside generate-component-registry.mjs, and the generated definition looks like this: {
        key: 'logos',
        label: 'Logos',
        type: 'stringarray',
        default: [],
        elementType: 'string'
      }. I want the generator to recognize the "logos" being images and somehow append the ui: {
              component: 'ContentImageField'
            } key so that the content editor recognized it and shows the image helpers. Make sure the solution is compatible to the content layer in how it recognizes element types.

## Implementation Summary
Implementation Summary: Generator now tags image-like string arrays with ContentImageField UI metadata and the content builder renders the image helper for those arrays, enabling logos lists to use ImageKit tooling.

## Documentation Overview
- Expanded the generator’s image-field heuristic so stringarray props like `logos` automatically receive the `ContentImageField` UI configuration.
- Updated the content builder’s stringarray renderer to respect custom UI components, reusing the existing ImageKit-backed field with array context metadata.
- Ensured primitive array detection keeps `elementType` data untouched so the content layer continues to serialize values consistently.

## Implementation Examples
```ts
// Generated registry snippet
{
  key: 'logos',
  label: 'Logos',
  type: 'stringarray',
  default: [],
  ui: { component: 'ContentImageField' }
}

// Builder template now swaps to ContentImageField for arrays with UI components
<component
  v-if="prop.ui?.component"
  :is="prop.ui.component"
  :model-value="propDraft[prop.key][index]"
  :prop-definition="prop"
  :field-context="{ propKey: prop.key, arrayIndex: index }"
  @update:modelValue="(value) => handleStringArrayChange(prop.key, index, value)"
/>
```
