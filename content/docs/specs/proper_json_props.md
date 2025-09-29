# Proper JSON Props

## 1. Investigate Current Handling
_Status (2025-09-26): ✅ Completed_
- Confirmed `json`-typed props were stored as raw strings in the document body and rendered in the builder as single-line inputs, making arrays hard to edit.

## 2. Normalise JSON Props During Load/Save
_Status (2025-09-26): ✅ Completed_
- Workbench deserialisation now parses JSON props (based on the component schema) so builder nodes keep structured arrays/objects rather than stringified payloads.
- Blank JSON props default to an empty array to avoid accidental `""` values.

## 3. Improve Builder Editing Experience
_Status (2025-09-26): ✅ Completed_
- The node editor renders `json` props in a monospace textarea with prettified content, inline validation, and error messaging.
- Invalid JSON no longer overwrites the stored value until fixed, enabling a safer editing loop that matches the desired UX from the spec.
