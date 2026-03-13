# Events Public Board + SVG Map

## Scope
Added publication-aware infrastructure and public conference delivery flow:
- `isPublished` preserved on CSV re-imports
- admin edit/filter support for publication state
- public published-only conferences endpoint
- reusable dependency-free SVG world map component

## API
- Admin:
  - `GET /api/events/conferences` (now supports `published` filter and returns `publicationCounts`)
  - `PATCH /api/events/conferences/:id` (now supports `isPublished`)
  - `POST /api/events/conferences/import-csv` (preserves existing `isPublished`)
- Public:
  - `GET /api/events/public/conferences` (published-only + `isOnline` classification)

## UI
- Admin page `/admin/events/conferences` now exposes publication controls.
- Reusable map component:
  - `app/components/events/ConferenceWorldMap.vue`
  - Inline SVG rendering, no map dependencies.
