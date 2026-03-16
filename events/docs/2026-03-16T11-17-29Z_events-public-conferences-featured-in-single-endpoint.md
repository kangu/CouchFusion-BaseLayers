# Initial Prompt
For the public facing /conferences, make sure to update the API call to also get the featured conferences.Make sure it is a single API call for both the featured and the list of conferences.

# Plan
1. Extend the existing public conferences endpoint response with featured conference payload.
2. Resolve featured entries from `events_featured_conferences` document and join them to published conferences data.
3. Preserve current/future-month and existing query filter behavior for list conferences.
4. Keep endpoint path unchanged to preserve single-call frontend integration.

# Implementation Summary
- Updated `layers/events/server/api/events/public/conferences.get.ts`:
  - imported featured document loader from `server/utils/featured-conferences`.
  - added `featured` array in response payload.
  - loaded featured document and conference docs in parallel.
  - resolved featured entries in configured order, including:
    - `conferenceId`,
    - conference display fields (name/date/location/links/mode),
    - admin-configured image metadata (`imageUrl`, `imageAlt`, `imageFileId`).
  - kept conferences list behavior intact (published + current/future-month gating + existing filters/sorting).

# Next Steps
1. Validate endpoint response includes both `conferences` and `featured` from a single request.
2. Verify featured entries with missing conference ids are safely skipped.
