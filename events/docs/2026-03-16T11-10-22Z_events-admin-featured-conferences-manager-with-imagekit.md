# Initial Prompt
Provide a way in the Conferences admin page to manage a list of featured conferences. Any of the listed conferences can be toggled on or off of this featured list. The user should be able to see cards of conferences and drag and drop them to rearrange them in the featured list. Provide an option to upload a logo or other image through the Image Kit Upload System.

# Plan
1. Add a dedicated featured-conferences persistence model in the events layer database.
2. Add focused admin API endpoints to read and save featured conference configuration.
3. Implement a new Featured Conferences manager section inside `/admin/events/conferences`.
4. Support add/remove, enabled toggle, drag-and-drop reorder, and ImageKit image upload per featured card.
5. Keep existing conferences board behavior unchanged.

# Implementation Summary
- Added featured-conferences persistence utilities in `layers/events/server/utils/featured-conferences.ts`:
  - document id: `events_featured_conferences`,
  - normalized featured entry model with `conferenceId`, `enabled`, and optional image metadata,
  - helper to load and normalize stored document.
- Added new admin APIs:
  - `layers/events/server/api/events/conferences/featured.get.ts`
    - returns `{ rev, featured, conferences }` for management UI,
    - conference catalog is resolved from existing conferences view (`by_start_date`).
  - `layers/events/server/api/events/conferences/featured.patch.ts`
    - persists ordered featured entries,
    - deduplicates/normalizes entries,
    - keeps `createdAt` and updates `updatedAt`.
- Updated admin page `layers/events/app/pages/admin/events/conferences.vue` with a new Featured Conferences section:
  - searchable "add to featured" list,
  - featured cards with `Enabled` toggle,
  - remove action,
  - native drag-and-drop reordering,
  - per-card image upload via `/api/imagekit/upload` (ImageKit upload system),
  - clear image action,
  - explicit `Save Featured List` persistence flow with success/error feedback.
- Kept scope isolated:
  - no changes to existing conferences CRUD APIs,
  - no changes to existing table filters/sorting/editor/import flows,
  - no public-page rendering changes (admin-only as requested).

# Next Steps
1. Test `/admin/events/conferences` as admin/curator:
   - add/remove featured conferences,
   - reorder via drag-and-drop,
   - toggle enabled state,
   - upload/clear featured images,
   - save and reload to verify persistence.
2. If needed later, expose this featured list in public `/conferences` using the same stored document.
