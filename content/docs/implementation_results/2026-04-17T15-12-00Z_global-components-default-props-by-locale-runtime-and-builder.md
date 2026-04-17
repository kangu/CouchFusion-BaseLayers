# Global Components: Locale-Aware Default Props

## Scope
Implemented locale-aware defaults for global components so global aliases can have different prop values per language while preserving current fallback behavior.

## Data model
Added optional field on global component entries:
- `defaultPropsByLocale?: Record<string, Record<string, unknown>>`

Updated in:
- `layers/content/utils/global-components.ts` (type + normalization)
- `layers/content/app/composables/useGlobalComponentsRegistry.ts` (client normalization)
- `layers/content/app/components/runtime/content/types.ts` (runtime type)

## Runtime merge behavior
In `Content.vue`, when rendering a global alias:
1. Start from `defaultProps`
2. Merge locale-specific defaults from `defaultPropsByLocale[currentLocale]` (if present)
3. Merge page/local props (local still wins)

This keeps existing override semantics while allowing language-specific global defaults.

## Builder behavior (no extra UI introduced)
Workbench now determines active locale from page path + i18n config and uses locale-aware global defaults:
- Alias hydration in editor merges shared + current-locale defaults.
- Global cards preview props in picker use current-locale merged defaults.
- Editing alias props in builder persists to:
  - `defaultProps` when editing default locale pages,
  - `defaultPropsByLocale[locale]` when editing non-default locale pages.

## Fallbacks
- If there is only one locale, behavior remains effectively identical to previous (shared `defaultProps`).
- If locale-specific defaults are missing for a locale, renderer falls back to shared defaults.

## Validation
- `apps/nuxt-app-starter`: `npx nuxi prepare` passed.

## Files changed
- `layers/content/utils/global-components.ts`
- `layers/content/app/composables/useGlobalComponentsRegistry.ts`
- `layers/content/app/components/runtime/content/types.ts`
- `layers/content/app/components/runtime/content/Content.vue`
- `layers/content/app/components/builder/Workbench.vue`
