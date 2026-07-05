# Resize label on divider hold

## Summary
- Updated the inline live editor divider state so the preview width label appears as soon as the divider receives pointer-down, before the drag activation threshold is crossed.
- Kept the label visible during active dragging by deriving it from both pending and active divider drag states.
- Covered the behavior in the focused section placement/preview scroll builder test.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/section-placement-preview-scroll.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run --reporter=dot`
