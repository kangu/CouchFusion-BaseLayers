# Component Picker Tabs + Category Metadata

## Scope
- Layer: `layers/content`
- Area: Builder `Select Component` dialog and component registry definitions

## Implemented

### 1. `ComponentDefinition.category`
- Added optional `category?: string` on `ComponentDefinition` in:
  - `layers/content/app/types/builder.ts`

### 2. Vue-level category assignment support
- Updated registry generator (`layers/content/scripts/generate-component-registry.mjs`) to read:
  - `export const builderComponentMeta = { category: '...' }`
- Generated definitions now initialize with:
  - `category: 'default'`
- If `builderComponentMeta.category` is present, it overrides default.

### 3. Default fallback for missing category
- Updated `useComponentRegistry` merge step to normalize category and fallback to `default` when missing/empty.
- Base inline components now explicitly set to `basic` category:
  - `p` (Paragraph)
  - `span` (Span)
  - `strong` (Strong Text)
  - `template` (Template/Slot)

### 4. Component Picker tab filtering UI
- Added top-level tabs in `ComponentPickerDialog`:
  - `All`
  - Discovered categories (including `Basic` and `Default` as applicable)
- Filtering now applies by selected tab + search query.
- Category names are normalized internally (`lowercase`, trimmed) and label-formatted in UI.

## Usage for component authors
In a content component `.vue` file, add a non-setup script export:

```ts
export const builderComponentMeta = {
  category: 'layout'
}
```

If omitted, the component appears under `Default`.

## Verification
- Ran `cd apps/nuxt-app-starter && npx nuxi prepare` successfully.
