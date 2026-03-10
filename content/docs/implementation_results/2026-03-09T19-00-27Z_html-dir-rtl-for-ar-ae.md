# HTML Direction Attribute for Arabic (UAE)

## Request
Ensure `ar-ae` applies RTL direction alongside the existing `lang` attribute.

## Change
Updated:
- `/layers/content/app/plugins/content-locale-html-lang.ts`

Implementation details:
- Kept existing reactive SSR-safe `lang` binding.
- Added reactive `dir` binding on `<html>`:
  - `dir="rtl"` when active locale is `ar-ae`
  - `dir="ltr"` for all other locales

## Impact
- Initial SSR HTML now includes direction metadata for Arabic (UAE).
- Client-side route changes update both `lang` and `dir` in sync.
