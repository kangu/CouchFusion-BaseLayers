# Debounce detected-input MJML preview updates

## Scope
Reduce rapid re-rendering while editing extracted MJML text/href fields by debouncing preview propagation.

## Changes
- Updated `app/pages/admin/email-templates/[id].vue`:
  - Added a debounced scheduler for `renderMjmlFromDetectedInputs`.
  - Wired extracted text and linked href input handlers to the debounced scheduler.
  - Set debounce delay to `500ms`.
  - Added timer cleanup in `onBeforeUnmount`.

## Result
Typing in detected text/href fields no longer recompiles/re-renders preview on every keystroke; updates are applied after 500ms pause.
