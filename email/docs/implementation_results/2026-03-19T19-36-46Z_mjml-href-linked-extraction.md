# MJML href-linked extraction for editable text detection

## Scope
- Extended MJML text extraction to also detect static `href` attributes on tags that contain extracted text placeholders (for example `mj-button`).
- Kept extraction non-invasive for dynamic links using `{{ ... }}`.

## Backend updates
- `server/utils/email-templates.ts`
  - Added `hrefLinks` to extraction result.
  - Added `MjmlHrefLink` structure with:
    - `textPlaceholder`
    - `hrefPlaceholder`
    - `href`
    - `tagName`
  - After text extraction, performs href pass:
    - Finds tags with `href="..."`/`href='...'`
    - Requires linked inner text placeholder
    - Replaces href value with `[<text-placeholder>-href]`-style placeholder
    - Returns metadata for UI linking.
- `server/api/email-templates/extract-texts.post.ts`
  - Returns `hrefLinks` alongside `texts` and `transformedMjml`.

## Frontend updates
- `app/pages/admin/email-templates/[id].vue`
  - Extended extract API response typing with `hrefLinks`.
  - Extended persisted editable entry model with href-related fields.
  - Linked href metadata to detected text entries by `textPlaceholder`.
  - Added rendering/replacement for href placeholders when rebuilding MJML.
  - Added linked href input UI under matching text entry and marked it as priority.
  - Added guard to exclude href placeholders from text placeholder pairing to avoid order mismatch.

## Result
- For `<mj-button ... href="https://...">Go to POW Lab</mj-button>`, detection now yields two linked editable elements:
  - button label text (`Go to POW Lab`)
  - button href (`https://...`)
