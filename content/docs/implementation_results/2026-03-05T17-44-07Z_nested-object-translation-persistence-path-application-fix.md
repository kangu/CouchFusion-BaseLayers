# Initial Prompt
When persisting translations that are nested inside objects for languages make sure the values are applied correctly.

# Plan
1. Verify persistence path for locale save and fixed-field propagation.
2. Add encoded-pointer resolution for serialized `:propKey` JSON storage when reading/writing fixed and changed paths.
3. Ensure translation route and apply logic use the same pointer resolution for nested object values.

# Implementation Summary
- Updated `layers/content/server/utils/content-i18n.ts`:
  - Added encoded-pointer aware resolution/set helpers for body paths:
    - direct path support
    - fallback to serialized `:propKey` JSON path support
  - Updated persistence-critical functions to use encoded-pointer support:
    - `collectChangedFixedBodyPaths(...)`
    - `applyFixedBodyPaths(...)`
    - `applyBodyPathsFromSource(...)`
  - Result: nested object values inside serialized props now compare/apply correctly during locale save and propagation.

- Updated translation handling (from related fix path) so persistence staging and overwrite checks are aligned:
  - `layers/content/server/utils/llm-translations-run.ts`
    - nested serialized prop extraction/apply support
    - pointer text resolver helper
  - `layers/content/server/api/content/llm-translations/translate.post.ts`
    - `overwriteMode=missing` target lookup now uses pointer resolver helper

- Updated fixed path extraction for serialized props:
  - `layers/content/utils/i18n-body.ts`
    - parses `:propKey` JSON values and maps to schema key paths

# Next Steps
1. Re-run translation for a nested localized key (e.g. `primaryButton.label`) and persist target locale.
2. Verify the target page doc body shows the nested value updated under serialized prop storage.
3. Verify propagation of fixed/global nested fields still works correctly across locales after save.
