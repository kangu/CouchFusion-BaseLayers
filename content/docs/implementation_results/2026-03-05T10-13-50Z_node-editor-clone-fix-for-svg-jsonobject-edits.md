# Initial Prompt
When I pasted the SVG into the icon field, it worked, but I got this error in the console: structuredClone failed, falling back to JSON clone: DataCloneError ...

# Plan
1. Inspect `NodeEditor.vue` cloning path from the reported stack trace.
2. Make cloning resilient to Vue proxy/reactive values emitted by nested object/array editors.
3. Keep fallback behavior but suppress noisy warning for expected DataCloneError cases.

# Implementation Summary
- Updated `layers/content/app/components/builder/NodeEditor.vue`.
- Added `toCloneablePlainValue()` helper that recursively:
  - unwraps reactive/proxy objects with `toRaw`
  - converts arrays/objects to plain cloneable data
  - preserves `Date` values
  - handles circular references through `WeakMap`
- Updated `cloneValue()` to run on the deep plain value before calling `structuredClone`.
- Kept JSON fallback clone path.
- Adjusted warning behavior:
  - `DataCloneError` no longer logs noisy warning (expected clone edge case)
  - other clone failures still warn.

# Next Steps
1. Re-test SVG editing in toolkit icon field and confirm console warning no longer appears.
2. If any remaining clone warnings appear in other builder flows, apply the same deep-unwrapping strategy to `Workbench.vue` clone helpers.
