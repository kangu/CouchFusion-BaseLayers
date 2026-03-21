# Reservation Workflow + Worker Scheduled Dashboard

## Summary
Implemented reservation scheduling on maintenance jobs, customer cancelation state, and worker-scoped scheduled dashboard behavior.

## Implemented
- Extended job lifecycle with:
  - `scheduled`
  - `canceled_by_customer`
- Extended maintenance job model with:
  - `appointmentAt` (ISO datetime or null)
  - `reservationNotes` (string or null)
- Updated automatic job creation (client create + cron) to initialize reservation fields as null.
- Updated jobs API listing:
  - returns reservation fields
  - employee-only sessions now see only `scheduled` jobs assigned to that employee.
- Updated job status transitions:
  - admin can move `pending -> scheduled` (requires assigned worker and `appointmentAt`)
  - admin can move `scheduled -> canceled_by_customer`
  - `done/rejected` allowed from `pending` and `scheduled`
  - employee can transition only their assigned jobs.
- Updated jobs UI:
  - admin tabs: Pending / Scheduled / Archived
  - reservation scheduling modal (datetime + notes)
  - customer cancelation action for scheduled jobs
  - employee view shows assigned scheduled reservations.

## Verification
- `bun run build` from `apps/gas-maintenance` completed successfully.
