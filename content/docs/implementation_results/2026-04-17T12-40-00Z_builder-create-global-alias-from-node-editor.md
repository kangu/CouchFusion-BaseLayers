# Builder: Create Global Alias from Node Editor

## Scope
Completed the recommended approach so editors can create a global component alias directly from the node editor/workbench, without manually wiring raw JSON in `/admin/pages` first.

## What was implemented
- Added a new node header action in `NodeEditor.vue`: **Create global alias**.
- Added callback plumbing (`onCreateGlobalAlias`) through recursive node editor rendering so any component node can trigger alias creation.
- In `Workbench.vue`, implemented a dedicated modal flow:
  - Pre-fills suggested alias name from current component id.
  - Validates alias naming format (`PascalCase`-like start, alnum/`_`/`-`).
  - Loads admin global component entries.
  - Creates or overwrites alias defaults from current node props (with overwrite confirmation).
  - Stores alias config via existing admin save API (`useGlobalComponentsRegistry().saveAdmin`).
  - Replaces current node component id with the new alias.
  - Keeps only internal builder/content metadata props locally on the node.
- Added modal inline error styling class used by this flow (`.builder-section-name-modal__error`).

## Runtime behavior
- Newly created alias becomes available through the already integrated runtime registry merge path.
- Local node props can still override global defaults (existing warning behavior remains unchanged).

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files touched
- `layers/content/app/components/builder/NodeEditor.vue`
- `layers/content/app/components/builder/Workbench.vue`
