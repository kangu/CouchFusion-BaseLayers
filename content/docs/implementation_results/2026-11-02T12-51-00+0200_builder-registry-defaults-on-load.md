# Builder: registry defaults for props a page does not store

## Problem

A block stored as `[id, {}]` renders its component defaults on the public page, but in the
builder (`/builder`, `/k`) every field of that block was empty and the inline preview rendered
empty values (no menu, empty lists). Found in `apps/paleologu-prosti`, whose fixtures now carry
full props as a workaround (`scripts/page-defaults.ts`).

Two causes, both in the Workbench's document-to-tree step (`deserializeEntry`):

1. `createNode(component)` built the node with registry defaults, then `node.props` was replaced
   by the stored props, so a `{}` block reached the node editor with no values. The node editor
   reads `node.props` correctly and falls back to `""` / `[]`; it never writes anything on open
   (checked against all 12 paleologu-prosti blocks).
2. `normalizeJsonProps` wrote `":key": "[]"` for every `jsonarray`/`stringarray` prop the
   document did not contain. The runtime renderer parses that into `[]`, which overrides the
   component default: this is what emptied the preview (`prosti-header` lost its menu), and the
   `"[]"` was saved over the default with the next save.

## Decision: fill missing props into the node when the page loads

Defaults are written into the builder node, in the builder's storage encoding, when a document
loads. They reach CouchDB with the next save. The alternative, showing defaults in the node
editor only, was rejected:

- A loaded `{}` block becomes identical to a block added in the builder (`createNode` already
  stores defaults) and to apps that store full props. One stored shape instead of two.
- The editor, the preview and the saved document read the same value. Everything that reads
  `node.props` (`visibleWhen` conditions, search, focused editor, translation pointers) sees
  the defaults without a second "virtual" layer in the 4,000-line node editor.
- Once saved, default copy is part of the document, so translation and LLM page operations can
  see and change it. Display-only defaults would never be translatable.
- Opening a page does not mark it unsaved: `ContentAdminWorkbench` takes the first document the
  builder emits after loading (which already contains the defaults) as the saved snapshot.

Trade-offs:

- After a page is saved, later changes to a component's defaults no longer reach it. This is
  already true for every block added in the builder.
- Only registry defaults are filled. A component default the registry generator cannot capture
  (a factory or computed value) has no registry default. That prop stays missing, so the
  component's own default renders in the preview and nothing empty is saved; its field shows
  empty in the editor, as before.

## Changes

- `app/utils/contentBuilder.ts`
  - `builderPropStorageKey(key, type)`: `stringarray`/`jsonarray`/`jsonobject` → `:key`,
    otherwise `key`. `normalizeBuilderComponentProps` now uses it.
  - `applyBuilderPropDefaults(component, props, lookup)`: for each registry prop with a
    `default` that the props lack under both `key` and `:key`, writes the default as the builder
    saves it: a JSON string under `:key` for lists and objects, a cloned plain value under `key`
    otherwise (same encoding as `apps/paleologu-prosti/scripts/page-defaults.ts`). Stored
    values, including `""`, `false`, `0` and `"[]"`, are kept.
  - `normalizeBuilderJsonProps(component, props, lookup)`: the Workbench's `normalizeJsonProps`,
    moved here so it can be tested. A list the document does not contain now stays missing; a
    stored value that is not a list still becomes `"[]"` as before.
- `app/components/builder/Workbench.vue`, `deserializeEntry`: uses `normalizeBuilderJsonProps`,
  then calls `applyBuilderPropDefaults` after the paragraph step. Order matters: the built-in
  `p` definition has `align: 'left'` as its default, and filling it before the paragraph step
  would override an alignment stored as a `text-align` style. Every document the Workbench receives
  (the `initialDocument` prop, the exposed `loadDocument`, the debug import) goes through
  `applyDocument` → `deserializeEntry`.
- `NodeEditor.vue` is unchanged.

## Verification

- `tests/builder/builder-prop-defaults.spec.ts` (12 tests): a `{}` block loads with every
  default in storage encoding; lists without a registry default stay missing; stored and empty
  values are kept under either key; Vue-bound keys and bare lists are read first; defaults are
  not shared with the registry; a loaded `{}` block serializes to full props with no `""` or
  `"[]"`; the builder's preview document renders through `<Content>` with the same HTML as the
  stored `{}` document; the node editor shows the defaults (text, textarea, number, boolean,
  list count, string list, object fields) and writes nothing on open; the Workbench applies
  defaults after the paragraph step.
- Re-running those tests with the old behaviour (no fill, `"[]"` injection) fails 8 of 12,
  including the preview and node-editor tests.
- Real data: every block of the paleologu-prosti public and test pages (28 blocks), reduced to
  its `__builder*` keys, loaded with the app's registry and serialized again, equals the
  full-props fixture exactly.
- The running paleologu-prosti dev server compiles the changed `Workbench.vue` and
  `contentBuilder.ts`; a temporary `{}` copy of `/test/head` rendered its default menu on the
  public page and was deleted afterwards.
- Live in the builder (`/k/tmp-empty-props/head`, a `{}` copy of `/test/head`, deleted
  afterwards): the page opened as "All changes saved"; all 26 fields of the three blocks showed
  their defaults (the header menu list with its 4 items); the inline preview rendered the
  builder's document (blocks carry `data-builder-uid`) with the same text as the public page at
  the same viewport (identical SHA-256); the document the Save button sends
  (`getSerializedDocument()`, read without saving) matched the full-props fixture exactly,
  apart from `__builder*` keys.
- Suites: `bunx vitest run --config vitest.config.ts content/tests` → 274 passed, 3 failed, all
  unrelated to this change and failing at HEAD: `focused-editor-mode.spec.ts` expects
  `void restoreTreeFocusAfterFocusedEdit(session)`, which is not in `Workbench.vue` at HEAD;
  `content-admin-workbench-translation-menu.spec.ts` (2) reads
  `app/components/admin/ContentAdminWorkbench.vue` relative to the working directory.
  `bun test content/tests/scripts` → 19 passed, 1 failed (`generator-contract.test.mjs`,
  `applyImageFieldUi`, already failing at HEAD).

## Noted, not changed

- `createNode` (new blocks) still stores list and object defaults as raw values under the bare
  key; the editor and the renderer accept both forms, and the first edit converts the value to
  `:key`. Using `applyBuilderPropDefaults` there would give new blocks the same encoding.
- `apps/paleologu-prosti/agents.md` ("Content") still says a `{}` block opens with empty fields;
  with this layer change that is no longer true, though its full-props fixtures stay valid.
