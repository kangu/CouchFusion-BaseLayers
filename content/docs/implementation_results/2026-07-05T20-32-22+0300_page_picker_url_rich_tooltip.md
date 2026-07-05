# Page Picker URL Rich Tooltip

## Summary
- Replaced the native title tooltip on the builder URL trigger with the shared `RichTooltip`.
- The tooltip now displays:
  - `URL: ...`
  - `Page name: ...`
  - `Updated at: ...`
- Updated `RichTooltip` description rendering to preserve newline-separated tooltip details.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/page-picker-dialog.spec.ts content/tests/builder/rich-tooltip.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
