# Events Layer Foundation

## Scope
Initial reusable foundation for conference/event operations:
- CouchDB database initialization (`${dbLoginPrefix}-events`)
- Conference design docs/views
- CSV import parsing + normalization
- Conference listing and import APIs
- Admin conferences UI route

## Routes
- `GET /api/events/conferences`
- `POST /api/events/conferences/import-csv`
- Page: `/admin/events/conferences`

## Notes
- CSV parser currently targets semicolon-delimited sources and includes fallback logic for shifted confirmation markers.
- Layer depends on auth/database via `extends: ["../auth"]`.
