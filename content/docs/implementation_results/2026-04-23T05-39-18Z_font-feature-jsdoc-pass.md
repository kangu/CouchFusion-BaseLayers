# Font feature JSDoc pass (content layer)

## Scope
- Added thorough JSDoc documentation across content-layer font feature source files so contributors can quickly understand architecture, contracts, and API rationale.

## Updated files
- `layers/content/server/utils/content-fonts.ts`
  - added module-level architecture overview
  - documented data model interfaces and constants
  - documented normalization/parsing/persistence/apply lifecycle helpers
  - documented rationale for runtime CSS + attachment-backed resolution
- `layers/content/server/api/content/fonts/settings.get.ts`
- `layers/content/server/api/content/fonts/settings.put.ts`
- `layers/content/server/api/content/fonts/apply.post.ts`
- `layers/content/server/api/content/fonts/runtime.css.get.ts`
- `layers/content/server/api/content/fonts/active/[key].get.ts`
- `layers/content/server/api/content/fonts/asset/[name].get.ts`
- `layers/content/server/api/content/fonts/preload.get.ts`
  - each endpoint now has concise intent + rationale docs
- `layers/content/app/plugins/content-runtime-fonts.ts`
  - documented preload strategy, dedupe rationale, and runtime head injection behavior
- `layers/content/app/composables/useContentFontSettings.ts`
  - documented client state model and admin action semantics

## Verification
- Ran:
  - `bunx vitest --config layers/content/vitest.fonts.config.ts --run layers/content/tests/server/font-assets.spec.ts`
- Result:
  - `1 passed`, `8 passed`.
