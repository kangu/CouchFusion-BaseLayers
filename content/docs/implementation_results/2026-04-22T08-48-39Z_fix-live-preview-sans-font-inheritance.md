# Initial Prompt
When I change the sans family in the typography section, I don't see any changes in the preview section.

# Plan Followed
1. Inspect live preview font override path in `Workbench.vue`.
2. Fix sans inheritance so preview subtree actually uses overridden `--font-sans`.

# Implementation Summary
- Updated `layers/content/app/components/builder/Workbench.vue`:
  - In `previewTypographyStyle`, added:
    - `fontFamily: "var(--font-sans)"`

Reason:
- Overriding `--font-sans` on preview container alone is not enough when descendants inherit `font-family` as a computed value from outside.
- Setting `font-family` directly on the preview wrapper ensures sans dropdown changes are visible immediately in live preview.

# Verification Evidence
- Source-level verification of new inline style in `previewTypographyStyle`.

# Proposed Next Steps
1. Change sans family in Typography without clicking Apply and confirm body/paragraph text in preview updates immediately.
2. Keep display checks separately on heading-heavy blocks.
