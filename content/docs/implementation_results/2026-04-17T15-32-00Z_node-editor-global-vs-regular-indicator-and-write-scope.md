# Node Editor Indicator: Regular vs Global Alias + Write Scope

## Scope
Implemented node-level UX indicators so editors can clearly see:
- whether a component is a regular component or a global alias,
- and for global aliases, whether edits write to shared defaults or locale-specific defaults.

## What changed

### Workbench wiring
`Workbench.vue` now passes context into node editor:
- enabled global alias id list,
- write mode (`shared` or `locale`),
- active locale and default locale.

### Node editor UI
`NodeEditor.vue` now renders in component header:
- `Regular` badge for regular components,
- `Global alias` badge for alias components,
- sublabel for alias write target:
  - `Writes shared defaults (XX)` on default locale,
  - `Writes locale defaults (YY)` on non-default locale.

This context is forwarded recursively to child node editors as well.

## Styling
Added compact badge and sublabel styles in `NodeEditor.vue` scoped styles.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/app/components/builder/Workbench.vue`
- `layers/content/app/components/builder/NodeEditor.vue`
