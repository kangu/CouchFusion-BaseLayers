# Initial Prompt
When I have a translation done for a single language and I persist it, what ends up happening is all languages get update with that value. Investigate why and fix. I only want in this case for the "es" language to be updated for /0/1/primaryButton/label and nothing else.

# Plan
1. Inspect locale persistence flow for how `fixedBodyPaths` are resolved on save.
2. Identify why nested localized path (`/0/1/primaryButton/label`) is treated as fixed/global during locale persist.
3. Update save logic to avoid stale master fixed-path metadata overriding fresh incoming schema-derived fixed paths.
4. Keep propagation behavior intact for truly fixed/global fields only.

# Implementation Summary
- Root cause: `saveLocalizedPageDocument` merged fixed paths as a union of:
  - master metadata fixed paths
  - incoming document fixed paths
- If master metadata still contained stale paths from earlier schema state, localized nested fields could be reclassified as fixed and then propagated globally when saving a locale.

- Updated `layers/content/server/utils/content-pages-save.ts`:
  - Replaced union-based fixed path resolution with `resolveEffectiveFixedBodyPaths(existing, incoming)`.
  - New behavior:
    - if incoming fixed paths exist, they are authoritative
    - otherwise fallback to existing master fixed paths
  - Applied in both branches:
    - default locale save path
    - non-default locale save path

- Effect for your case:
  - Persisting `es` translation for `/0/1/primaryButton/label` now updates only `es` for that localized field.
  - Other locales are no longer overwritten by stale fixed-path propagation for that field.

# Next Steps
1. Re-run: translate `primaryButton.label` to `es` and persist.
2. Verify only `page-/index::es` changes for that localized field and no cross-locale overwrite occurs.
3. If any legacy docs still contain stale fixed paths, opening/saving from current builder metadata will now correct future behavior.
