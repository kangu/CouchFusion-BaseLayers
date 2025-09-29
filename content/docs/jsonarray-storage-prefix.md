# Jsonarray Storage Prefix

## Initial Prompt
Do the same thing for jsonarray, keep the raw json key with a : at the beginning, but in the UI work with it without the :

## Implementation Summary
Mapped jsonarray props to use :prefixed storage keys while keeping UI keys unchanged, preserving colon-prefixed data in serialized documents.

## Documentation Overview
- Updated `NodeEditor` storage helpers to map jsonarray props to `:<key>` slots for persistence while editing the plain `key` value.
- Normalization in `Workbench` now rewrites incoming jsonarray props to colon-prefixed keys so saved documents always include the Nuxt Content hint.
- The content builder continues to provide structured CRUD controls for jsonarray entries without exposing the prefixed keys.

## Implementation Examples
- `layers/content/app/components/builder/NodeEditor.vue:289` – storage key helper now prefixes jsonarray keys with `:` and removes legacy entries during saves.
- `layers/content/app/components/builder/NodeEditor.vue:452` – jsonarray updates persist to the prefixed key while clearing any non-prefixed remnants.
- `layers/content/app/components/builder/Workbench.vue:62` – normalization shifts jsonarray data to colon-prefixed keys and ensures arrays remain parsed for editing.
