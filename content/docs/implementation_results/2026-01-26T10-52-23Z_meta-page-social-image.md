# Context
- Layer: `layers/content`
- Feature: Social preview image for content pages (SEO image)
- Scope: Admin workbench UX, schema/serialization, runtime head meta

# Changes
- Added `seo.image` to content page schema/types and normalized conversions (client, server, store) with absolute-URL enforcement.
- Extended Builder Workbench page config with a social image field powered by `ContentImageField` (browse/upload/local), and exposed the field in create/duplicate modals.
- Enabled automatic head tag emission (`og:image`, `twitter:image`, `twitter:card`) via `useContentPage` when a social image is present.

# Verification
- Manual: Loaded ContentAdminWorkbench, selected a page, set a social image via the new field (ImageKit/local), saved; the saved document contains `seo.image`. Navigated to a runtime consumer using `useContentPage` and verified head includes `og:image`/`twitter:image` with the absolute URL. No automated tests were run.***
