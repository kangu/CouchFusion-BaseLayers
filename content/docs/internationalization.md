# Content Layer Internationalization Spec

## Goals
- Add internationalization support to the content layer.
- Allow node editor + workbench to edit per-language variations of page content.
- Configure which props are localizable vs fixed from prop definitions.
- Support localized page URLs with language prefixes (`/fr/...`, `/de/...`).
- Provide a minimal, translation-tool-inspired UX for language switching and translation status.
- Keep impact on existing apps minimal.
- Deliver test implementation in:
  - `/Users/radu/Projects/nuxt-apps/apps/radustanciu`

## Decisions (Confirmed)
- SSR support is required and must work correctly.
- Locale config shape: `content.i18n = { defaultLocale, locales }` is accepted.
- Default locale URL stays unprefixed (`/about`), not `/en/about`.
- Fallback behavior: if locale value is missing, fallback to default locale.
- Status focus: treat missing translation value as the stale/missing signal.
- Track last change timestamp for each locale.
- Localization must also work for nested deep values (not only flat text fields).
- Initialize `updatedAt` immediately for default locale metadata.
- Keep all translatable content fully inside minimark `body.value`.
- Keep i18n linkage/status metadata outside minimark (`meta.contentI18n`).
- Use one CouchDB document per locale page, linked to a master page.
- Translation docs are full-page copies.
- On non-master edits, auto-write fixed fields to master and propagate in the same request.
- Use CouchDB bulk fetch + bulk update for locale propagation.
- Apply migration model only for newly created/edited pages.
- Plain minimark text nodes are localizable by default.

## Sections and Progress
- [x] Section 0: Spec structured with resumable checklist and confirmed decisions.
- [x] Section 1: Locale configuration in content layer + `apps/radustanciu`.
- [x] Section 2: Locale-prefixed URL parsing/resolution in middleware/store (SSR-safe).
- [x] Section 3: Localizable prop contract in schema/registry (`builderFieldMeta` driven).
- [x] Section 4: Node editor/workbench locale switcher UX.
- [x] Section 5: Locale-aware persistence model with per-locale timestamps.
- [x] Section 6: Runtime localized value resolution with default fallback (SSR + client).
- [x] Section 7: Missing/stale indicators in editor.
- [x] Section 8: Radustanciu test wiring + validation + docs update.

## Implementation Notes
- Prioritize backward compatibility for existing non-localized page documents.
- Keep serialization changes additive and guard by config/metadata.
- Avoid broad refactors outside the content layer and target app.
- Validation caveat: local automated test run is blocked by missing environment dependencies (`jsdom`, `_tests/setup/content.ts`).
