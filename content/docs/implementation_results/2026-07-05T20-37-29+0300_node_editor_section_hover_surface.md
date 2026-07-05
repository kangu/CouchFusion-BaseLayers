# Node Editor Section Hover Surface

## Summary
- Added a subtle blue hover state for non-isolated node editor section panels.
- The hover treatment uses a pale blue surface, soft blue border, and restrained blue shadow.
- Isolated focused editor panels are excluded from the hover surface change.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
