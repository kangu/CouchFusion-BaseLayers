# Layer: events

`Runtime: nuxt 4.1.x, vue 3.5.x`

Conferences & events management layer for the Bitvocation app. Provides conference CRUD, CSV import, conference proposals, featured conferences, public board, world-map component, Nostr watcher notifications, cron-driven next-year recreation, and admin curators. The only consumer is `apps/bitvocation`.

## Folder map

- `app/components/events/` — `ConferenceWorldMap.vue` (inline SVG map).
- `app/pages/admin/events/conferences.vue` — admin conferences index.
- `app/utils/conference-sort.ts` — sort helpers + `ConferencesSortDirection` type.
- `server/api/events/conferences/` — `index.get.ts`, `index.post.ts`, `[id].patch.ts`, `[id].delete.ts`, `featured.get.ts`, `featured.patch.ts`, `import-csv.post.ts`, plus `[id]/` subroutes (`favorite`, `watch`).
- `server/api/events/conference-proposals/` — `index.get/post`, `[id].patch/delete`.
- `server/api/events/public/conferences.get.ts` — public board endpoint.
- `server/api/cron/conferences-recreate-next-year.post.ts` — cron endpoint.
- `server/plugins/init.ts` — ensures events DB + design docs at startup.
- `server/utils/` — conference-csv, conference-next-year-recreation, conference-preferences, conference-proposal, conference-status, design-documents, events-db, featured-conferences, nostr-notifications, require-conference, assert-events-admin-session.
- `utils/register-layout.ts` — registers admin nav.
- `docs/` — many dated implementation notes + `implementation_results/`.
- `nuxt.config.ts` — registers `#events` alias, `extends: ['../auth']`, layout module.

## Public API / Exports

- Alias: `#events` — e.g. `#events/server/utils/events-db`, `#events/server/utils/conference-preferences`.
- Auto-imported utils (Nitro resolves `server/utils/`): `getEventsDatabaseName`, `ensureEventsDatabase`, `parseConferenceCsv`, `recreateConferencesForNextYear`, `normalizeConferencePreferences`, `setConferencePreference`, `normalizeProposalStatus`, `isProposalOpen`, `normalizeConferenceStatus`, `requireConferenceDocument`, `assertEventsAdminSession`, `getFeaturedConferencesDocument`, `normalizeFeaturedEntries`, `previewConferenceWatchersNostrMessage`, `notifyConferenceWatchersViaNostr`, plus constants `CONFERENCE_STATUS_*`, `CONFERENCE_PROPOSAL_*`, `FEATURED_CONFERENCES_DOCUMENT_ID`, design doc `conferencesDesignDocument`.
- Types: `ConferenceDocument`, `ConferenceProposalDocument`, `ConferenceProposalStatus`, `UserConferencePreferences`, `FeaturedConferenceEntry`, `FeaturedConferencesDocument`, `RecreateConferencesNextYearStats`, `ParsedConferenceCsv`.
- Server endpoints under `/api/events/conferences/*`, `/api/events/conference-proposals/*`, `/api/events/public/conferences`, `/api/cron/conferences-recreate-next-year`.
- Admin nav: `events` section, `/admin/events/conferences` (requires `admin` or `curator`).

## Conventions

- All conferences live in a dedicated events DB (name via `getEventsDatabaseName`); design docs seeded by `server/plugins/init.ts`.
- Admin mutations require `requireAuthenticatedUser` (from `#auth`) + `assertEventsAdminSession` for `admin`/`curator` gating.
- Conference status values must come from `CONFERENCE_STATUS_OPTIONS` — use `normalizeConferenceStatus` to sanitize input.
- Proposal statuses (`pending`/`accepted`/`rejected`) normalized via `normalizeProposalStatus`.
- Use `#events` alias for cross-file imports within the layer.
- Keep dated notes in `docs/` with `YYYY-MM-DDTHH-MM-SSZ_<topic>.md` naming.

## Dependencies

- Runtime peerDeps: `nuxt ^3.12.0 || ^4.0.0`.
- Extends `layers/auth` (`extends: ['../auth']` in `nuxt.config.ts`); imports `#auth/server/utils/authenticated-user` and `#auth/server/utils/nostr-config`.
- Transitively depends on `layers/database` (CouchDB client + types like `CouchDBDocument`, `CouchDBDesignDocument`) via `#auth`/`#database`.
- Uses `layers/imagekit` patterns indirectly for featured-conference images (featured manager stores ImageKit paths, not files).
- Expects consuming app to provide Nostr keys/config and CouchDB instance.

## Build / Test commands

- No standalone lint/typecheck/test script in `package.json`.
- Tests (if added) run via `layers/vitest.config.ts`: `npx vitest run layers/events` from repo root.
- Lint/typecheck via consumer: `apps/bitvocation` — `bun run lint`, `bun run typecheck`.

## Gotchas / Pitfalls

- `server/plugins/init.ts` runs `ensureEventsDatabase` on boot — design-doc changes require a restart or manual reseed.
- Nostr notifications publish DMs to watchers; modes (dual publish) — see `2026-03-14-events-nostr-dm-modes-dual-publish.md`.
- Public board endpoint filters current+future months; admin index does not (see March 2026 docs).
- `[id]` route params are URL-encoded conference ids — decode before lookup (see `2026-03-13-events-patch-id-decode.md`).
- Featured conferences stored as a single doc (`FEATURED_CONFERENCES_DOCUMENT_ID`); normalize via `normalizeFeaturedEntries`.
- Admin bypass was removed (see `2026-03-13-events-admin-bypass-removed.md`) — always assert session.
- `events` layer is bitvocation-specific; do not assume it generalizes without refactor.

## Cross-references

- Root conventions: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/` and `docs/implementation_results/`
- Depends on: `layers/auth` (and transitively `layers/database`)
- Related skills: `couchfusion-layer-builder`
- Consumer: `apps/bitvocation`
