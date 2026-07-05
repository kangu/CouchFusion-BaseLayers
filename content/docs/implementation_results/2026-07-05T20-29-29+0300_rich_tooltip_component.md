# Rich Tooltip Component

## Summary
- Added a reusable `RichTooltip` UI component in the content layer.
- Applied it to the Select Component dialog icon-only header buttons for desktop preview, mobile preview, updated sort, and name sort.
- Removed native `title` attributes from those icon buttons so the rich tooltip is the single hover/focus affordance.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/rich-tooltip.spec.ts content/tests/builder/component-picker-dialog-categories.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
