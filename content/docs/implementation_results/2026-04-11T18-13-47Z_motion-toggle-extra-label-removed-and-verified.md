# Initial Prompt
Use http://localhost:6018/k/ to render and check that the buttons looks ok. It has an extra label appearing

# Plan
1. Reproduce the UI issue in `/k/` with `dev-browser`.
2. Inspect rendered motion toggle DOM/computed styles to identify the extra visible label source.
3. Apply minimal UI-only fix.
4. Re-verify in `dev-browser`.

# Implementation Summary
## Reproduction
- Opened `http://localhost:6018/k/` in inline builder using `dev-browser`.
- Confirmed extra visible text near icon toggle.
- DOM inspection showed the extra label came from:
  - `<span class="sr-only">Keep Animations Running</span>`
- In this context, `sr-only` utility styles were not applied, so the label rendered visibly.

## Fix
- Updated:
  - `layers/content/app/components/admin/ContentAdminWorkbench.vue`
- Removed the `sr-only` span from the icon button.
- Accessibility remains covered via existing `aria-label` on the button.

## Verification
- Re-opened `http://localhost:6018/k/` with `dev-browser` after patch.
- Confirmed:
  - no extra visible label text node remains,
  - button still has `aria-label` (`Keep Animations Running disabled`),
  - tooltip still renders on hover/focus path.

# Proposed Next Steps
1. If you want, I can commit the last two content-layer UI changes together (icon tooltip + extra-label cleanup) in one commit.
