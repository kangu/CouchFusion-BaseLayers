# Remote Select via `builderFieldMeta` in Node Editor

## Initial Prompt
Update builder meta tags to allow a custom node editor select type with options fetched from an external API at runtime, with label/value path mapping, credentials included, always refreshed, and disabled+error hint on failure.

## Implementation Summary
- Added runtime remote-select support to node editor select controls through a shared `NodeRemoteSelect` component.
- Implemented `ui.remoteOptions` metadata contract under `builderFieldMeta` and propagated typing support.
- Kept registry generation as metadata-only (no fetch during generate time), per requirement.
- Wired remote select behavior across all select render paths:
  - top-level prop selects
  - `jsonobject` field selects
  - `jsonarray` item selects (including nested arrays)
- Added documentation updates for authors and the local node-editor component skill.

## Metadata Contract
```ts
export const builderFieldMeta = {
  category: {
    type: 'select',
    ui: {
      remoteOptions: {
        url: '/api/categories',
        itemsPath: 'data.items',
        labelPath: 'name',
        valuePath: 'id',
      },
    },
  },
}
```

## Runtime Behavior
- Fetches options using `fetch(url, { credentials: 'include' })`.
- Parses nested payloads via dot-paths (`itemsPath`, `labelPath`, `valuePath`).
- Fetches on mount and refetches on focus (no caching).
- On error:
  - options are cleared
  - select is disabled
  - inline hint rendered with error message

## Key Files
- `layers/content/app/components/builder/node-editor/NodeRemoteSelect.vue`
- `layers/content/app/components/builder/node-editor/NodePropsPanel.vue`
- `layers/content/app/components/builder/node-editor/NodeObjectField.vue`
- `layers/content/app/components/builder/node-editor/NodeArrayItem.vue`
- `layers/content/app/types/builder.ts`
- `layers/content/docs/guide_for_authoring_valid_content_components.md`
- `skills/node-editor-component-builder/SKILL.md`

## Validation
- Attempted test run:
  - `bunx vitest --config vitest.config.ts --run content/tests/builder/node-editor-search.spec.ts`
- Result: blocked by CouchDB connectivity in this environment (`EPERM` to `127.0.0.1:5984` / `::1:5984`), so automated execution could not complete.
