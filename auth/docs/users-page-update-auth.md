# Users Page Update (Auth Layer)

## Initial Prompt
Implement the specs in apps/bitvocation-demo/docs/specs/users_page_update.md. Proceed step by step with each section and mark that in the spec document as it's done to be used as reference when resuming work at a future time.

## Implementation Summary
- Added stats cards, expired-active alert list, status badges, and horizontal scrolling to the Users admin table while exposing new profile columns (`pages/users.vue`).
- Extended the edit dialog with date pickers plus Telegram, LinkedIn, referral source, and comments fields and persisted them back to CouchDB via the auth store update flow (`pages/users.vue`, `layers/auth/app/stores/auth.ts`).
- Expanded CSV import/export and CouchDB bulk import handling to cover the new profile attributes with sanitized inputs (`pages/users.vue`, `layers/auth/server/api/users/import.post.ts`).

## Documentation Overview
Auth-layer types and store helpers now recognize additional profile attributes so user documents fetched from CouchDB expose Telegram, LinkedIn, referral source, and comments data. The update flow merges these values when admins save edits, keeping the cached Pinia state consistent.

The bulk import endpoint trims and sanitizes the new profile fields before writing to `_users`, ensuring cleaner data even when administrators map CSV columns directly to profile keys.

## Implementation Examples
- When `/api/users` responds, each `profile` now includes the optional `telegram_handle`, `linkedin_url`, `referral_source`, and `comments` keys for downstream consumers.
- A PUT to `/api/users/{id}` may supply any subset of these profile fields; the store and backend merge them with existing profile data so other attributes are preserved.
- CSV imports that map to the new profile keys will persist sanitized values via `users/import.post.ts`, allowing administrators to enrich multiple records at once.
