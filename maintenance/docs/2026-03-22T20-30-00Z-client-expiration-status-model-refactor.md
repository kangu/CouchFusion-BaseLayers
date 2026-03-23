# Client expiration status model refactor

## Scope
- Removed single client-level lifecycle status from maintenance client domain.
- Introduced status fields attached to each expiration date.
- Converted overhaul and gas sensor schedule fields from base/due semantics to expiration-date semantics.
- Kept compatibility for legacy payload/document fields.

## Implemented changes
- Updated client type model:
  - Added `contractExpirationStatus`, `overhaulExpirationStatus`, `gasSensorExpirationStatus`.
  - Added `overhaulExpirationDate`, `gasSensorExpirationDate`.
  - Removed client-level `status` and legacy `*BaseDate/*DueDate` fields from typed model.
- Updated parsers:
  - Replaced client-status parser with expiration-status parser.
  - `contractCheckupIntervalMonths` now defaults server-side to `12` when contract dates are present.
  - Schedule parser now accepts expiration date/status fields and legacy aliases.
- Updated APIs:
  - `POST/PATCH /api/maintenance/clients` now write/read expiration date + expiration status fields.
  - `GET /api/maintenance/clients` now returns normalized expiration fields and status values with legacy fallback mapping.
- Updated cron:
  - Removed discontinued-client filtering.
  - Reads `contractExpirationDate`, `overhaulExpirationDate`, `gasSensorExpirationDate`.
  - Marks only the corresponding expiration status as `expiring_soon`.
- Updated job completion:
  - `check_2y` completion sets contract expiration to completion date + interval months (default 12).
  - `overhaul_10y` completion sets overhaul expiration to completion date + 120 months.
  - `gas_sensor_change` completion sets gas sensor expiration to completion date + gas sensor period months.
  - Each job resets only its corresponding expiration status to `active`.
- Updated clients admin page:
  - Removed client-level status editing/display.
  - Added date-specific status controls.
  - Renamed overhaul/gas sensor fields to expiration dates.
  - Removed 2-year interval input from UI.

## Migration behavior
- Init plugin now migrates legacy client docs into the expiration-status model and removes deprecated keys from migrated documents.

## Verification
- `apps/gas-maintenance`: `bun run build` passed.

## Admin UI refinements after implementation
- Compacted the contact methods panel in the client dialog to reduce vertical space.
- Grouped lifecycle fields by flow (`2Y`, `10Y Overhaul`, `Gas Sensor`) with expiration date and status together.
- Grouped the service address fields into a card and added a Google Maps search link based on entered address values.
