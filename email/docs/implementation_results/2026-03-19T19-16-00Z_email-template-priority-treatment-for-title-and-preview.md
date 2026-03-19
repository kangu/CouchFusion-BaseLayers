# Email Template Priority Treatment for mj-title / mj-preview

## Request
Apply special treatment for `<mj-title>` and `<mj-preview>` editable text fields so users know they are more important than other detected text segments.

## Changes
Updated `layers/email/app/pages/admin/email-templates/[id].vue`:

- Added priority metadata on detected editable entries:
  - `priorityTag: 'mj-title' | 'mj-preview' | null`
  - `isPriority: boolean`
- Implemented placeholder-to-tag resolution by inspecting `transformedMjml` for `[placeholder]` usage inside:
  - `<mj-title>...</mj-title>`
  - `<mj-preview>...</mj-preview>`
- Applied the same priority metadata on rehydration of persisted entries so saved templates retain the same prioritization UI.
- Updated Dynamic Parameters input rendering:
  - priority rows use highlighted blue styling,
  - show badge `Priority · mj-title` or `Priority · mj-preview`.

## Verification
Playwright on `/admin/email-templates/welcome_to_pow_lab` after `Detect texts from MJML` confirms:
- two priority badges are rendered,
- labels include `Priority · mj-title` and `Priority · mj-preview`.
