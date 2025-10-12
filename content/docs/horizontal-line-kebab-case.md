# Initial Prompt
Make sure the seralized component uses kebab-case form for the horizontal-line component

# Implementation Summary
Normalised component identifiers during builder load/save so PascalCase entries (like HorizontalLine) are converted to kebab-case before serialization, ensuring Nuxt resolves the registered component rather than rendering custom-element tags.

# Documentation Overview
- `contentBuilder` now lowercases and hyphenates component ids (e.g., HorizontalLine → horizontal-line) when generating the minimal content structure.
- The builder workbench performs the same normalisation when loading existing documents, so the tree uses registry-friendly identifiers and still recognises legacy PascalCase entries.
- This keeps rendered output aligned with Nuxt’s auto-registered component names, preventing `<horizontalline>` artefacts in the DOM.

# Implementation Examples
- `layers/content/app/utils/contentBuilder.ts:47` – introduces `normalizeComponentId` and applies it before serializing nodes.
- `layers/content/app/components/builder/Workbench.vue:23` – normalises incoming component names during deserialisation so the builder tree and registry stay in sync.
