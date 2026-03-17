# Events Nostr DM Modes (NIP-17 / NIP-04 / Dual)

## Scope
Implemented configurable Nostr DM publish modes for conference watcher notifications.

## What Changed
- Updated `events/server/utils/nostr-notifications.ts` to support:
  - `nip17` mode
  - `nip04` mode
  - `dual` mode (attempt both)
- Added `NIP-04` dispatch using encrypted `kind:4` events.
- Kept existing `NIP-17` dispatch path.
- Improved relay handling:
  - wait for each relay publish result with timeout
  - log per-relay ack/failure
  - treat delivery as failed only when all relays fail for a given mode
- In `dual` mode, a watcher send succeeds if at least one mode succeeds.

## Config
- DM mode comes from CouchDB `_config` section (`cf_env_[slug]`) key:
  - `nostr_dm_mode` = `nip17` | `nip04` | `dual`
- Fallback runtime override remains available through auth layer runtime config.

## Files
- `events/server/utils/nostr-notifications.ts`
