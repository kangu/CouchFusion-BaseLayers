# Maintenance Layer Stabilization (Steps 1 and 2)

## Changes
1. Updated maintenance role guard forbidden response:
- from `404 Not found`
- to `403 Access denied`

File:
- `server/utils/assert-maintenance-role.ts`

2. Updated job reschedule date parsing to accept ISO date or datetime:
- supports current jobs UI datetime-local behavior
- keeps compatibility with date-only payloads

Files:
- `server/utils/dates.ts`
- `server/api/maintenance/jobs/[id]/reschedule.patch.ts`

3. Updated layer README to match the current client-contract model.

File:
- `README.md`
