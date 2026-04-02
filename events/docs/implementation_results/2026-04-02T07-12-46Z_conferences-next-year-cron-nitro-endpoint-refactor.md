# Initial Prompt
Refactor the script so it is moved inside a Nitro server API endpoint.

# Plan
1. Locate existing cron endpoint conventions and conference recreation dependencies.
2. Implement reusable server-side conference recreation logic in the events layer.
3. Expose a new authenticated Nitro cron endpoint that runs the recreation job and returns stats.
4. Remove stale/broken package script wiring that points to the old standalone script path.
5. Validate Nuxt server type generation (`nuxt prepare`) for import/path correctness.

# Implementation Summary
- Added conference recreation service at:
  - `layers/events/server/utils/conference-next-year-recreation.ts`
- Added authenticated Nitro cron endpoint at:
  - `layers/events/server/api/cron/conferences-recreate-next-year.post.ts`
- Endpoint behavior:
  - Requires `Authorization: Bearer <cronSecret>` (same pattern as other cron routes).
  - Calls the service and returns `success`, `nowIso`, and execution stats.
- Service behavior:
  - Scans conference docs from events DB (`conference:*` range).
  - Filters to conferences with `recreateNextYear === true` and `startDateIso` in the previous UTC month.
  - Creates next-year draft conference docs (`isPublished: false`), resets status to default, shifts start date by one UTC year, and writes year-suffixed slug/doc id.
  - Skips duplicates if next-year doc already exists.
  - Returns detailed counters for created/skipped cases.
- Removed stale package command from `apps/bitvocation/package.json`:
  - removed `cron:recreate-conferences-next-year` that pointed to missing `./scripts/recreate-conferences-next-year.ts`.

# Validation
- Ran:
  - `bun run --cwd apps/bitvocation postinstall`
- Result:
  - `nuxt prepare` completed successfully and generated types.

# Proposed Next Steps
1. Point your scheduler to `POST /api/cron/conferences-recreate-next-year` with `Bearer <cronSecret>`.
2. Run one dry/manual execution in staging and inspect the returned counters.
3. Add an integration test fixture around previous-month selection + duplicate skip behavior.
