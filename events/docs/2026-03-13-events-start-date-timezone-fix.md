# Events Start Date Timezone Fix

## Problem
`startDateIso` imported from CSV was sometimes one day behind `startDateLabel`.

Example:
- `Start Date` label: `Jan 16, 2026`
- previous stored `startDateIso`: `2026-01-15`

Root cause:
- CSV parsing used `new Date(label).toISOString().slice(0, 10)`.
- For local-midnight date strings, converting to UTC can shift the day backward.

## Implementation
Updated `parseStartDate` in:
- `layers/events/server/utils/conference-csv.ts`

Changes:
- Added strict handling for explicit date-only strings (`YYYY-MM-DD`) and validation.
- For non-ISO labels (like `Jan 16, 2026`), parse with `Date` but serialize using local calendar parts (`getFullYear()`, `getMonth() + 1`, `getDate()`), not `toISOString()`.

## Result
- Imported `startDateIso` now keeps the intended calendar day and matches human label semantics.
- No UTC day rollback for date-only input strings.
