# Public Conferences API: Featured Discount Fields

## Request
Enable featured carousel cards in app UI to show conference discounts when available.

## Changes
- Extended `GET /api/events/public/conferences` featured payload with:
  - `discountCode`
  - `discountLabel`
- Mapped both fields from the source conference document when resolving featured entries.

## Files
- `/Users/radu/Projects/nuxt-apps/layers/events/server/api/events/public/conferences.get.ts`

## Notes
- Backward compatible payload extension; existing consumers continue to work.
