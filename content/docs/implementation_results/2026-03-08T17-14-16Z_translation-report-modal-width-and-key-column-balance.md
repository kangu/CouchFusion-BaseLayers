# Initial Prompt
Make the Translation Report window wider so the Translation column is visible. The Key column should be smaller.

# Plan
1. Locate translation report modal sizing constraints and table column widths.
2. Increase results modal max width with minimal scope to translation results modal only.
3. Rebalance table column widths to reduce key column and allocate more width to translation text.
4. Keep behavior/layout logic unchanged beyond CSS sizing.

# Implementation Summary
Updated `layers/content/app/components/admin/ContentAdminWorkbench.vue` CSS:
- Increased translation results modal width:
  - `.modal__panel--translation-results` now uses `width: min(100% - 1rem, 82rem)`.
- Rebalanced translation table width profile:
  - `.translation-modal__translations-table` `min-width` reduced from `960px` to `900px`.
  - Key column width reduced from `26%` to `16%`.
  - Original column width set to `34%`.
  - Translation column width increased to `50%`.

Result: the Translation column receives significantly more horizontal space, and the modal itself is wider for desktop usage.

# Next Steps
1. Verify visually at `http://localhost:7833` on desktop and laptop viewport widths.
2. If you want an even wider dialog, increase cap from `82rem` to `88rem`.
