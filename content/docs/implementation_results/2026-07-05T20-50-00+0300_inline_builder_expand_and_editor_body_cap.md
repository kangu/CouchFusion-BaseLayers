# Inline Builder Expansion And Editor Body Cap

## Summary
- Removed the inline live editor's fixed `720px` left-sidebar maximum.
- Changed the resize clamp so the builder can expand until the live preview reaches a 320px minimum width.
- Added an `800px` max-width cap to `.content-admin-workbench__editor-body` so the editor content remains readable inside a wider builder panel.
- Added a focused builder test for the new resize and editor-body width contract.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
