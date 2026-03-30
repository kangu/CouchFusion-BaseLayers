# Maintenance employee full-name support

## Summary
- added support for storing employee full names in auth-backed user documents
- followed the auth-layer naming pattern with `profile.full_name` as the primary field
- updated maintenance assignment UI to display full names when available

## Changes
- employee create API now accepts `fullName` and stores it in:
  - `profile.full_name`
  - top-level `full_name`
- employee patch API now updates `profile.full_name` while preserving other existing `profile` keys
- employee list API now returns `fullName`
- maintenance employees admin page now supports create/edit/list for full names
- jobs page assignment dropdown now shows full names when available and falls back to stripped usernames
- assignment success/status text now also prefers the full name

## Shared helper
- added `layers/maintenance/utils/employee-display.ts`
- helper reads names in this order:
  - `profile.full_name`
  - `profile.fullName`
  - top-level `full_name`

## Verification
- passed:
  - `bun test layers/maintenance/utils/employee-display.test.ts`
  - `cd /Users/radu/Projects/nuxt-apps/apps/gas-maintenance && bun run build`

## Notes
- job documents still store `assignedTo` as the existing username value for compatibility
- only display labels changed; assignment and permission logic still use the stored username value
