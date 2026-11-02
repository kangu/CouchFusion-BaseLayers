# Registry generator: negative numbers

## Problem

Babel parses `-8` as a `UnaryExpression` (`-`) around the `NumericLiteral` 8. The generator only
accepted `NumericLiteral`, so negative numbers were silently lost:

- prop defaults (`century: -8` → no default; in arrays `[-1, 0, 2]` → `[0, 2]`),
- field type inference from compared values,
- `builderFieldMeta` / `builderComponentMeta` values (`ui: { min: -10 }` → dropped).

Found while migrating the Sala site (`apps/paleologu-prosti`), whose classics used negative
centuries for BC dates.

## Fix

- New `scripts/registry-literals.mjs`: `readNumericLiteral(node, types)` returns the number for a
  numeric literal or `-`/`+` applied to one (`-8`, `+3`, `-0.5`, `- -2`), `undefined` otherwise;
  `isNumericValue` wraps it.
- `scripts/generate-component-registry.mjs` uses it in `nodeToValue` (defaults),
  `inferFieldTypeFromValue` and `objectExpressionToLiteral` (builder metadata, including arrays).
  No bare `types.isNumericLiteral(` checks remain.

## Verification

- `bun test layers/content/tests/scripts` → new `registry-literals.test.mjs` passes (signed values,
  non-numbers ignored, generator wired to the helper).
- End to end: the generator run for `apps/paleologu-prosti` on a temporary probe component produced
  `offset: -8` with `ui.min: -10`, `points: [-1, 0, 2]`, `items: [{ century: -8 }, { century: 21 }]`,
  `tilt: 3` from `+3`. The probe was removed and the app registry regenerated (12 components).
- Pre-existing, unrelated: `generator-contract.test.mjs` "retains image hints…" fails because the
  generator no longer contains `applyImageFieldUi` (same at HEAD).

## Noted, not changed

A prop typed `number` without `builderFieldMeta` `type: 'number'` is still emitted as a `text`
field; authors add the type in metadata.
