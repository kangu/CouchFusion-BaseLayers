# Translation Report: Key/Value Output + Persist Locale Actions

## Scope
- Show translated key/value pairs in the translation report.
- Replace locale "open" action with "persist locale" action, then allow optional open.

## Changes
- `content/server/api/content/llm-translations/translate.post.ts`
  - Added `translations` list per locale result:
    - shape: `{ key, value }[]`
    - `key` is the body pointer (returned translation key)
    - `value` is translated text
  - Included empty `translations: []` for failed locale entries.

- `content/app/composables/useLlmTranslations.ts`
  - Extended `LlmTranslationLocaleReportEntry` with optional `translations` payload.

- `content/app/components/admin/ContentAdminWorkbench.vue`
  - Translation modal now renders per-locale cards with:
    - status and counts
    - full translated key/value list for successful locales
    - locale error message for failed locales
  - Replaced locale report action:
    - from `Open <locale>`
    - to `Persist <locale>`
  - After successful persist:
    - button becomes persisted state
    - optional `Open <locale>` action appears
  - Added locale persist flow:
    - saves staged locale document through `contentStore.saveDocument(..., { locale })`
    - updates notice feedback
    - clears staged state for persisted locale
  - Added/reset locale persistence state tracking for new translation runs and page switches.

## Validation
- `bun run build` from `apps/radustanciu` passed (SSR build successful).
