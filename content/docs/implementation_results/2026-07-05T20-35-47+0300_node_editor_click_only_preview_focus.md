# Node Editor Click-Only Preview Focus

## Summary
- Removed the root `focusin` preview-focus handler from `NodeEditor`.
- Kept live preview highlight flashing for explicit clicks inside the node editor.
- Automatic/programmatic field focus now avoids sending the default flash highlight to the live preview.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
