# `v-imagekit` Fixed + Dynamic Transform Merge Support

## Scope
- Layer: `imagekit`
- File: `/Users/radu/Projects/nuxt-apps/layers/imagekit/plugins/imagekit-directive.ts`

## What changed
The shared `v-imagekit` directive now supports tuple-style binding values:
- `v-imagekit="[fixedTransforms, dynamicTransforms]"`

### Behavior
1. If binding value is a 2-item array, it is interpreted as:
- item 1: fixed/base transforms
- item 2: dynamic/override transforms

2. The directive now preserves source URL transforms and merges in order:
- source transforms from current image URL
- fixed transforms
- dynamic transforms (override by matching prefix)

3. Existing single-value syntax still works:
- `v-imagekit="'w-800,h-450'"`
- `v-imagekit="['w-800','h-450']"` (for arrays not using tuple pattern)

## Example
```vue
<img
  :src="photo"
  v-imagekit="['h-300', optionalPhotoDynamicTransforms()]"
/>
```

## Notes
- Gallery-specific implementation was kept as-is per request.
- The directive now provides equivalent generic merge capability for reuse across projects.
