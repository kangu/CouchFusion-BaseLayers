# Nostr First-Login Profile Seeding

## Scope
On first Nostr login (account creation path), enrich `_users` document from the user's Nostr kind-0 profile event.

## What Changed
- Added `auth/server/utils/nostr-profile.ts`:
  - queries configured Nostr relays for latest kind `0` metadata event by pubkey
  - extracts profile name (`name`, `display_name`, `displayName`, `username`)
  - extracts email (`email`, `contact_email`, `contactEmail`, `mail`, fallback `nip05` when email-like)
- Added relay-only config resolver in `auth/server/utils/nostr-config.ts`:
  - `getNostrRelayValues()`
- Updated `auth/server/api/auth/nostr/verify.post.ts`:
  - during new-user creation, fetch profile seed once
  - persist `email` when found
  - persist `profile.full_name` and `full_name` when found
  - existing-user login path remains unchanged

## Notes
- CouchDB auth username (`name`) remains system-generated (`dbLoginPrefix + random`) for compatibility with session/auth behavior.
- Friendly profile name is stored in `profile.full_name` and `full_name`.

## Files
- `auth/server/utils/nostr-profile.ts`
- `auth/server/utils/nostr-config.ts`
- `auth/server/api/auth/nostr/verify.post.ts`
