# Initial Prompt
What about these ones from the landing component? The Norwegian is missing. Are the flags coming in from the same source as the content layer?

# Plan
1. Verify `Landing.vue` locale flag source.
2. Ensure Norwegian resolves from shared locale metadata for both `no` and common alternates.
3. Keep change isolated to shared locale registry.

# Implementation Summary
- Confirmed `apps/radustanciu/app/components/content/Landing.vue` imports and uses:
  - `resolveLocaleMeta` from `#content/app/utils/locales-meta`
  - `localeMeta.flagSvg` for rendered flag markup
- Therefore, landing and content admin translation dialog both use the same shared locale metadata source.
- Added Norwegian aliases in shared registry:
  - `nb` -> Norwegian flag/label
  - `nn` -> Norwegian flag/label
- Updated file:
  - `layers/content/app/utils/locales-meta.ts`

# Proposed Next Steps
1. Hard refresh the page to clear stale HMR/browser cache and confirm Norwegian flag now renders.
2. If you want, I can also remove app-local locale name overrides in `Landing.vue` and rely fully on shared layer labels for one canonical source of truth.
