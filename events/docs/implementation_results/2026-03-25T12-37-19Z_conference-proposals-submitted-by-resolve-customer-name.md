# Conference Proposals: Resolve Submitted By to Full Name

## Request
In the Conference Proposals list, use the same `resolveCustomerName` approach as Orders to resolve submitted username to full name when available.

## Changes
- Added auth directory wiring in admin conferences page:
  - `useAuthStore()`
  - `adminUsersDirectory` + `userFullNameDirectory`
  - preload via `fetchAdminUsers()` (guarded with `try/catch`).
- Added helper logic matching Orders pattern:
  - `customerDirectory`
  - `stripCouchPrefix`
  - `extractRawCustomerCode`
  - `resolveCustomerName`
- Updated Conference Proposals UI to use resolver for submitted user display:
  - proposals table `Submitted By` column,
  - proposal details modal `Submitted By` row.

## File
- `/Users/radu/Projects/nuxt-apps/layers/events/app/pages/admin/events/conferences.vue`
