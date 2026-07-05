# Inline Workbench Horizontal Overflow Fix

## Summary
- Fixed the inline live editor sidebar so it scrolls vertically only and does not expose a horizontal scrollbar.
- Added shrink constraints to the inline workbench root and `ContentAdminWorkbench` root so the workbench fills the sidebar from side to side without exceeding its container.
- Kept the editor body content capped at 800px while allowing the wider shell to resize normally.
- Added a focused builder regression for the sidebar overflow contract.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/focused-editor-mode.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
