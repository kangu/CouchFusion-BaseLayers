# Workbench Viewport Width Cap

## Summary
- Replaced the builder workbench fixed `1200px` max-width with `calc(100vw - 320px)`.
- This lets the node editor expand farther across wide screens while preserving a 320px minimum space for the live preview.
- Added a focused builder test that locks the width contract.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
