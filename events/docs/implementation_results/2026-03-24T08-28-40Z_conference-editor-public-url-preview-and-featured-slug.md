# Conference Editor Public URL Preview + Featured Slug Exposure

## Scope
- Layer: `layers/events`
- Areas touched:
  - admin conference editor UI (`Links & Contact` section)
  - public conferences API featured payload shape

## Changes
1. Admin editor `Public URL` preview:
- File: `app/pages/admin/events/conferences.vue`
- Added `runtimeConfig` usage and URL base resolution:
  - prefer `runtimeConfig.public.siteUrl`
  - fallback `window.location.origin`
- Added computed `editorPublicUrl`:
  - outputs `${domain}/to/${slug}` (slug URL-encoded)
- Added emphasized read-only input at bottom of `Links & Contact`:
  - label: `Public URL`
  - read-only visual style (orange emphasis)

2. Featured payload slug support:
- File: `server/api/events/public/conferences.get.ts`
- Added `slug` to `PublicFeaturedConference` interface and response mapping so consuming apps can build `/to/<slug>` links from featured cards.

## Notes
- This is backward compatible for consumers that ignore the new `slug` property.
- No mutation to conference storage schema or update handlers.
