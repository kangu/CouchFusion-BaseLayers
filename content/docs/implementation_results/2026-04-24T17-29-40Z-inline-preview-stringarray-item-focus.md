# Inline Preview String Array Item Focus

## Summary
Fixed click-to-focus behavior for rendered string-array items in the inline preview. Preview components can emit indexed prop markers such as `sections.3.bullets.0`; the node editor now exposes matching indexed `data-content-prop-path` attributes on the corresponding string-array input labels.

## Root Cause
The preview marker path was specific to the clicked bullet item, but the node editor only exposed the parent array path for string-array controls. As a result, the focus bridge could select the broader section/array but could not focus the exact bullet input.

## Changes
- Added indexed prop-path attributes for nested `stringarray` fields inside `jsonarray` items in `NodeArrayItem.vue`.
- Added indexed prop-path attributes for top-level `stringarray` items in `NodeArrayItem.vue`.
- Extended the CouchFusion inline preview regression test to assert indexed string-array paths are available for focus targeting.

## Verification
- Browser verification on `/k/docs/vue-components`: clicking the bullet text `Run bun run registry:build after changing content components.` focused the matching input and kept the preview scroll delta at `0`.
- Ran targeted tests:

```bash
node --test apps/couchfusioncom/tests/inline-preview-focus-scroll.test.mjs apps/couchfusioncom/tests/docs-guides.test.mjs apps/couchfusioncom/tests/rich-text-fields.test.mjs apps/couchfusioncom/tests/home-redesign.test.mjs
```

Result: 11 passing tests, 0 failures.
