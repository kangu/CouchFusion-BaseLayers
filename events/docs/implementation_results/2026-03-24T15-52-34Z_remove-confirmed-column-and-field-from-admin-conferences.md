# Remove Confirmed Field From Admin Conferences

## Scope
Removed the legacy `confirmedDates` field from the admin conferences interface and conferences API/document flow. Published/draft now remains the only publication readiness signal.

## Changes
- Removed `Confirmed` column from `/admin/events/conferences` table.
- Removed `Confirmed Dates` toggles from create/edit conference forms.
- Removed `Dates Confirmed` hero stat card.
- Removed `Confirmed` column from CSV preview snapshot in the import dialog.
- Removed `confirmedDates` from conferences API payloads and response metadata:
  - `POST /api/events/conferences`
  - `PATCH /api/events/conferences/:id`
  - `GET /api/events/conferences` (`unfilteredCounts`)
- Removed CSV parsing assignment/fallback logic for `confirmedDates` from `ConferenceDocument` construction.

## Files
- `layers/events/app/pages/admin/events/conferences.vue`
- `layers/events/server/api/events/conferences/index.get.ts`
- `layers/events/server/api/events/conferences/index.post.ts`
- `layers/events/server/api/events/conferences/[id].patch.ts`
- `layers/events/server/utils/conference-csv.ts`
- `layers/events/docs/2026-03-13-events-inline-editing.md`
- `layers/events/docs/2026-03-13-events-admin-conferences-cards-table-toggle.md`

## Verification
- `cd apps/bitvocation && bun run build`
