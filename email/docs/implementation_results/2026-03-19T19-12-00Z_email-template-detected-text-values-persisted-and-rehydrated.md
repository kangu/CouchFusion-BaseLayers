# Email Template Detected Text Values Persisted + Rehydrated

## Request
Persist modified values from detected MJML text inputs on the template document and reload them when opening the editor again.

## Implementation
Updated `layers/email/app/pages/admin/email-templates/[id].vue` to persist and rehydrate editable MJML text metadata.

### Added persisted fields in page save payload
- `editableMjmlBase`: transformed MJML with `[placeholder]` tokens.
- `editableMjmlEntries`: array of `{ placeholder, originalText, value }`.

The existing template PUT API already spreads unknown payload fields into the CouchDB document, so no server API changes were required.

### Rehydration on load
- On template load, page now reads `editableMjmlBase` + `editableMjmlEntries`.
- Rebuilds editable input controls from persisted entries.
- Re-renders `editorState.mjml` from base + persisted values so editing resumes from saved state.

### Runtime behavior retained
- First detect run still injects `transformedMjml` (with placeholders) into main MJML field.
- Input edits still live-regenerate MJML and therefore HTML preview.

## Verification
Playwright flow validated:
1. Detect texts.
2. Edit first detected input to `PERSIST CHECK VALUE`.
3. Save changes.
4. Reload page.
5. Confirm detected input values are restored (`firstInputValue = PERSIST CHECK VALUE`).
