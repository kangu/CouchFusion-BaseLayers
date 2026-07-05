# Add Section Button Animation

## Summary
- Applied the selected prototype parameters to the real root `+ Section` button in the shared content builder.
- Added a scoped animated button structure with ripple, plus rotation, and seven sparkles.
- The button now plays the animation, turns to `#34aaf4`, then opens the existing component picker after the selected `190ms + 90ms` timing.
- Kept between-section insert buttons unchanged by routing only the main root add button through the animation handler.

## Parameters Applied
- Duration: `440ms`
- Purple/blue turn duration: `90ms`
- Turn delay: `190ms`
- Easing: `cubic-bezier(.2,.86,.24,1.12)`
- Scale peak: `1.08`
- Lift: `-2px`
- Plus rotation: `90deg`
- Ripple scale: `1.65`
- Accent: `#34aaf4`
- Secondary accent: `#abf75f`
- Glow: `18px`
- Radius: `10px`
- Sparkles: `7`
- Sparkle distance: `44px`

## Verification
- Vue SFC compile check for `content/app/components/builder/Workbench.vue`.
- `bunx vitest --config vitest.config.ts content/tests/builder/section-placement-workflow.spec.ts --run`
- `bunx vitest --config vitest.config.ts content/tests/builder --run`
- Browser check on `http://localhost:3012/k/about` confirmed the button has the selected variables, renders seven sparkles, animates on click, turns `#34aaf4`, and opens the component picker.

## Notes
- Browser console still shows the existing Nuxt runtime-config warning for `content`; this was not introduced by this change.
