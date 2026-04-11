# Initial Prompt
Implement both phases one after the other. For step 3, integrate the admin ui elements into the /admin/pages

# Plan
1. Add DB-backed i18n settings utilities and expose runtime/override/effective config.
2. Switch content server flows to use effective i18n config (not runtime-only) so admin changes apply consistently.
3. Implement phase 1 API to manage enabled locales (no default change via this endpoint).
4. Implement phase 2 API to migrate default locale with safe strategies.
5. Integrate language management UI directly into `/admin/pages`.
6. Validate type generation.

# Implementation Summary
- Added `layers/content/server/utils/content-i18n-settings.ts`:
  - defines settings doc `_id: content-settings:i18n`
  - resolves runtime + override + effective config
  - persists override updates
- Added `layers/content/server/utils/content-i18n-migration.ts`:
  - performs default-locale migration across page documents
  - supports strategies:
    - `strict` (requires target locale doc per page)
    - `fallback-copy` (clones old default content when target locale is missing)
- Added new admin APIs:
  - `GET /api/content/i18n-settings`
  - `PUT /api/content/i18n-settings` (phase 1 locale set management)
  - `POST /api/content/i18n-settings/migrate-default` (phase 2 default migration)
- Updated content server flows to use effective config:
  - pages list/get, delete, history, save flow, and LLM translation flow now resolve i18n from DB-backed effective config.
- Integrated UI into `layers/content/app/pages/admin/pages.vue`:
  - new “Languages” panel at top of `/admin/pages`
  - phase 1 controls:
    - locale toggles
    - add locale input
    - save language set button
  - phase 2 controls:
    - target default locale select
    - strategy select (`strict` / `fallback-copy`)
    - migrate default locale button
  - single-language handling:
    - migration button disabled with explanatory note when only one locale is enabled

Validation performed:
- Ran `npx nuxi prepare` in `apps/nuxt-app-starter` successfully.

# Next Steps
1. Restart the active dev server process if stale route/runtime cache prevents seeing latest `/admin/pages` UI changes immediately.
2. Test phase 2 migration on a staging dataset first (strict and fallback-copy) to validate content expectations.
3. Optionally add audit log entries for locale settings/migration actions (who changed what, when).
