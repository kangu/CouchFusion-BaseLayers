## Events admin manual conference creation

Date: 2026-03-13

### What was implemented
- Added `POST /api/events/conferences` in the events layer at `server/api/events/conferences/index.post.ts`.
- Added an **Add Manual Conference** action on `admin/events/conferences`.
- Added a modal form that creates a new conference document directly in CouchDB.

### API behavior
- Requires events admin session (`assertEventsAdminSession`).
- Validates required fields: `name`, `year`, `startDateIso`.
- Auto-derives:
  - `slug` (from name, if omitted)
  - `startDateLabel`, `dateRangeLabel`, `monthLabel` (from `startDateIso`, if omitted)
- Creates document id as `conference:{year}:{slug}`.
- Returns `409` when a document with that id already exists.

### Admin UX behavior
- New top action button: **Add Manual Conference**.
- Form groups fields into:
  - Core fields
  - Location & links
  - Contact/notes/todo and flags
- On success:
  - closes dialog
  - shows success message
  - refreshes conference list
- On failure:
  - shows inline error in dialog

