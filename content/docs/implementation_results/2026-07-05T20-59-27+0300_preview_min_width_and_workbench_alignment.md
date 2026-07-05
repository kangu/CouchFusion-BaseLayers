# Preview minimum width and workbench alignment

## Summary
- Refined the inline live editor sidebar clamp so the actual preview frame keeps a 320px minimum after divider and surrounding chrome are accounted for.
- Added a DOM-based preview chrome measurement helper instead of relying only on `window.innerWidth - 320px`.
- Restored the workbench editor body to an 800px maximum and aligned it to the right when the expanded sidebar has spare horizontal space.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run --reporter=dot`
