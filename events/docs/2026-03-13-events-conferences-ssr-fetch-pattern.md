# Conferences SSR Fetch Pattern

## Scope
Evaluated admin conferences data query behavior and aligned page fetch options with existing admin conventions.

## Behavior
- Initial conferences list load uses SSR `await useAsyncData(...)` and is not visible in browser network tools.
- Client-side filter updates trigger browser-visible API requests.

## Change
- In `app/pages/admin/events/conferences.vue`, list fetch now includes:
  - `requestHeaders` (cookie forwarding on server)
  - `credentials: 'include'`

## Context
This matches common admin fetch patterns used in Bitvocation admin pages.
