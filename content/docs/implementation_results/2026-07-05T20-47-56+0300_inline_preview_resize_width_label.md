# Inline Preview Resize Width Label

## Summary
- Added a fixed top-right resize label to the inline live editor.
- The label appears only while the divider is actively being dragged and displays the measured live preview iframe width.
- The width is sampled from the preview frame on animation frames so it tracks the rendered iframe area during resize.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/section-placement-preview-scroll.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
