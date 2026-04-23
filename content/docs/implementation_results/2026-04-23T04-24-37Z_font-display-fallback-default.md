# Initial Prompt
Let's try everywith with "fallback"

# Plan Followed
1. Switch the content-layer managed font generator from `swap` to `fallback`.
2. Keep preload/active-font endpoint flow intact.
3. Validate via focused content font tests.

# Implementation Summary
- Updated managed runtime font CSS generation:
  - [layers/content/server/utils/content-fonts.ts](/Users/radu/Projects/nuxt-apps/layers/content/server/utils/content-fonts.ts:792)
  - `font-display` output changed from `swap` to `fallback`.

- This affects:
  - future generated `app/assets/css/fonts.css` managed blocks
  - future generated `/public/fonts/managed/runtime-fonts.css`

# Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1` file passed
  - `7` tests passed
