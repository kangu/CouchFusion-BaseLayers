# Maintenance Layer: Multi-Schedule Support (2y / 10y / Gas Sensor)

## Changes
1. Data model extensions:
- Added job type support (`check_2y`, `overhaul_10y`, `gas_sensor_change`).
- Added client schedule fields for overhaul and gas sensor timelines.

2. Parsing/validation:
- Added schedule field parsing with due-date computation and gas sensor base+period pairing validation.

3. Cron:
- Expanded from single contract-expiration schedule to three schedule entries.
- Pending-job dedupe now keyed by `clientId + jobType`.
- Notification idempotency keys now include schedule category.

4. Job APIs:
- Preserve/normalize `jobType` for legacy jobs in assign/reschedule/status handlers.
- Done transition updates schedule-specific due dates based on completed date.

5. Clients API:
- Returns normalized nullable schedule fields for older records.

## Verification
- Built successfully via consuming app build (`apps/gas-maintenance`, `bun run build`).
