# Visual Section Placement Console Verification

## Initial Prompt

Check the authenticated Bitvocation builder console for errors after adding the visual section placement dialog.

## Implementation Summary

- Reproduced a Vue prop warning in the Bitvocation builder on `/k/about`.
- Root cause: `Workbench.vue` passed `globalComponentsRegistry.components` from the template. Because `components` is a nested Ref returned by `useGlobalComponentsRegistry()`, the placement dialog received the Ref object instead of `ContentGlobalComponentEntry[]`.
- Added `previewGlobalComponents` as a top-level computed array in Workbench and used it for both placement previews and the normal builder preview.
- Updated the section placement workflow test to assert the corrected prop wiring.

## Verification

Executed from `/Users/radu/Projects/nuxt-apps/layers`:

```bash
bunx vitest --config vitest.config.ts content/tests/builder --run
```

Result:

- 14 test files passed.
- 46 tests passed.

Authenticated reload of `http://localhost:3012/k/about` confirmed the placement-dialog `globalComponents` prop warning is no longer present.
