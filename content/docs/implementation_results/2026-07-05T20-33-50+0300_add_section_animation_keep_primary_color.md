# Add Section Animation Primary Color

## Summary
- Removed the alternate `is-purple` color state from the root `+ Section` button animation.
- Kept the play animation, ripple, glow, plus rotation, sparkles, and delayed component picker opening.
- The button now keeps its primary blue background instead of switching to the secondary/accent color during the animation.

## Verification
- `bunx vitest --config vitest.config.ts content/tests/builder/section-placement-workflow.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
