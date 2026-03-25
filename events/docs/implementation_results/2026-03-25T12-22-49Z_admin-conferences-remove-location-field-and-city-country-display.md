# Admin Conferences: Remove Location Field + City/Country Display

## Request
- Remove `Location` from conference editor (new + edit) Schedule/Geography context.
- Update admin table display so the location slot shows `City, Country`.

## Changes
- Removed `Location` input from create conference dialog section.
- Removed `Location` input from edit conference `Schedule & Geography` section.
- Updated admin table location column label to `City, Country`.
- Updated admin table location cell to render city/country composite text instead of `location`.
- Updated sort behavior for the location column to sort by the new city/country display value.
- Updated featured admin candidate/card location snippets to show city/country composite text.
- Updated featured admin search placeholders to reference city/country.

## Files
- `/Users/radu/Projects/nuxt-apps/layers/events/app/pages/admin/events/conferences.vue`
- `/Users/radu/Projects/nuxt-apps/layers/events/server/api/events/conferences/featured.get.ts`

## Notes
- Data model remains backward compatible; legacy `location` field is not removed from documents in this change.
