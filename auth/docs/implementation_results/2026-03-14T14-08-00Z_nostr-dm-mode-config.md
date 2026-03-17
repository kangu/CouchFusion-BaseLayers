# Nostr DM Mode Config Support

## Scope
Extended shared auth-layer Nostr config resolution to include notification DM mode selection.

## What Changed
- Updated `auth/server/utils/nostr-config.ts`:
  - added `dmMode` in returned config values
  - parses `nostr_dm_mode` from CouchDB `_config`
  - accepts values: `nip17`, `nip04`, `dual`
  - defaults to `nip17` when missing
  - throws on invalid values
- Updated `auth/nuxt.config.ts`:
  - added runtime fallback `nostrDmMode` via `NUXT_NOSTR_DM_MODE` / `NOSTR_DM_MODE`

## Files
- `auth/server/utils/nostr-config.ts`
- `auth/nuxt.config.ts`
