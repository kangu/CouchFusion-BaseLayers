# Email Preview Normal-Then-Fixed at 10px

## Requirement
When scrolling the whole page, keep HTML preview panel in normal flow initially, then fix it at `10px` from top after it reaches that point.

## Root Cause
Native CSS sticky behavior was unreliable in this admin layout/scroll context.

## Implementation
Updated `layers/email/app/pages/admin/email-templates/[id].vue` with a page-local JS sticky controller:

- Added refs/state:
  - `previewSectionRef`, `previewCardRef`
  - `isPreviewFixed`, `previewFixedStyle`, `previewPlaceholderHeight`
  - `previewFixTriggerY`
- Added scroll/resize handling:
  - compute trigger point from card position
  - when `window.scrollY` crosses trigger, switch preview card to fixed mode (`top: 10px`)
  - maintain placeholder block to prevent layout jump
  - recompute width/left for responsive correctness
- Fixed mode style:
  - `.email-preview-fixed { position: fixed; z-index: 30; }`
  - dynamic inline `top: 10px`, `left`, `width`

## Verified Behavior (Playwright)
Measured card state during scroll:
- `y=0` -> normal (`top=173`, static)
- `y=100` -> normal (`top=73`, static)
- `y=218` -> switches to fixed (`top=10`, fixed)
- `y=471` -> remains fixed (`top=10`)
- `y=854` -> remains fixed (`top=10`)
