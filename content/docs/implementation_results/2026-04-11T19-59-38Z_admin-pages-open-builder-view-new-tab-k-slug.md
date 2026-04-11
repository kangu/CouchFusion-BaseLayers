# Initial Prompt
Make the Open Builder and View actions open a new tab with the /k/[slug] or /[slug] respectively

# Plan
1. Update row action URL builders so builder route maps to `/k/[slug]`.
2. Ensure both actions open in a new browser tab from click handlers.
3. Keep root-path behavior safe (`/k/` and `/`).
4. Validate with `nuxi prepare`.

# Implementation Summary
- Updated `layers/content/app/pages/admin/pages.vue`:
  - Added `toSlug(path)` helper to normalize paths.
  - Changed builder route mapping to `/k/[slug]` (`/k/` for root).
  - Added public route mapping to `/[slug]` (`/` for root).
  - Changed `Open Builder` action to open `window.open(builderUrl, '_blank', 'noopener')`.
  - Changed `View` action to open `window.open(publicUrl, '_blank', 'noopener')`.
  - Replaced `NuxtLink` view action with button-triggered new-tab behavior for consistent handling.

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Optionally append `noreferrer` in `window.open` feature string if strict referrer isolation is desired.
