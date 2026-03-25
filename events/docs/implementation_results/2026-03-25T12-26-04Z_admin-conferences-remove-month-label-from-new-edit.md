# Admin Conferences: Remove Month Label From New/Edit

## Request
Remove `Month Label` from admin conference new/edit sections and clean up code related to that key.

## Changes
- Removed `monthLabel` from admin `ConferenceItem` typing in this page.
- Removed `monthLabel` from `editorForm` and `createForm` reactive state.
- Removed `monthLabel` reset in `resetCreateForm()`.
- Removed `monthLabel` from create payload body in `saveCreateConference()`.
- Removed `monthLabel` hydration in `openEditor()`.
- Removed `monthLabel` from edit payload body in `buildEditorPatchPayload()`.
- Removed UI input field `Month Label` from:
  - create conference dialog,
  - edit conference `Schedule & Geography` section.

## File
- `/Users/radu/Projects/nuxt-apps/layers/events/app/pages/admin/events/conferences.vue`

## Notes
- Existing persisted documents may still contain `monthLabel`; this change only removes admin form management of that key.
