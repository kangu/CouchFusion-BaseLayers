# Initial Prompt
Persist a new `recreateNextYear` boolean for conferences and support its use from admin create/editor workflows with monthly recreation automation.

# Plan
1. Extend conference document model to include `recreateNextYear`.
2. Update create/patch conference APIs to parse and persist the field.
3. Wire admin conferences create/editor forms to send and edit the field.
4. Keep changes minimal and backward-compatible for existing conference documents.

# Implementation Summary
- Added `recreateNextYear: boolean` to `ConferenceDocument` in `server/utils/conference-csv.ts`.
- Set CSV import default `recreateNextYear: false` for imported conferences.
- Extended `POST /api/events/conferences` payload parsing and persistence for `recreateNextYear`.
- Extended `PATCH /api/events/conferences/[id]` payload parsing and persistence for `recreateNextYear`.
- Added backward-compatible patch fallback using `Boolean(existingConference.recreateNextYear)` to normalize legacy docs without this field.
- Updated admin page create and editor forms to load/edit/submit `recreateNextYear` and expose checkbox controls in relevant sections.

# Validation
- Verified field propagation via static grep across model, API handlers, and admin UI bindings.

# Proposed Next Steps
1. Add API-level tests for create/patch behavior with and without `recreateNextYear`.
2. Backfill legacy conference docs if strict explicit `false` is desired everywhere.
