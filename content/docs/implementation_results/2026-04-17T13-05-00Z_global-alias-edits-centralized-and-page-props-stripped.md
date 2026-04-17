# Global Alias Editing: Centralized Defaults, No Page-Level Prop Persistence

## Issue observed
Editing a global alias node from page builder persisted changes into that page document as local props. This broke the expected global behavior where all instances should inherit from a shared registry default.

## Root cause
`Workbench.vue` handled all prop updates with a generic `updateNodeProp` path that always wrote to `node.props`, regardless of whether the node component id was a global alias.

## Fix implemented
### 1) Redirect alias prop edits to central registry
In `Workbench.vue`:
- `updateNodeProp` now detects when the edited node is a global alias.
- Non-internal prop changes (`__builder*` / `__content*` excluded) are queued as pending patches for that alias.
- Pending patches are applied to in-memory global registry defaults for immediate preview continuity.
- Changes are persisted with a debounced save to `/api/content/global-components/admin`.
- Admin settings are loaded once before persist to avoid overwriting hidden entries (for example disabled aliases).

### 2) Prevent page doc from storing alias-specific props
In `contentBuilder.ts`:
- Added optional serialization option `globalAliasIds`.
- For nodes whose component is in `globalAliasIds`, serializer strips regular props and keeps only internal metadata props (`__builder*` / `__content*`).
- `Workbench.vue` now passes `globalAliasIds` for both document serialization and preview serialization.

## Result
- Editing a global alias from a page updates the central global registry defaults.
- Page documents remain reference-like for alias nodes and no longer persist page-specific alias props.
- Existing pages with previously stored alias props are normalized on next save (props stripped for alias nodes).

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/app/utils/contentBuilder.ts`
