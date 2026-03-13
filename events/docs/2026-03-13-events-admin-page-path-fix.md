# Events Admin Page Path Fix

## Scope
Fixed admin conferences page registration for Nuxt 4 layer page discovery.

## Change
- Moved:
  - from `pages/admin/events/conferences.vue`
  - to `app/pages/admin/events/conferences.vue`

## Why
In this project setup, layer pages are resolved from `app/pages`. Keeping the file under `pages` caused route fallback/empty render behavior.

## Note
After path fix, access is still gated by auth layer middleware (`admin-auth`), which returns 404 for non-admin or missing session.
