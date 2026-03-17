# Events Nostr Notification Debug Logs

## Scope
Added verbose server-side logging for the admin-triggered Nostr notification publish flow.

## Added Logging Coverage
- watcher resolution start/result
- selected relay list and config section
- recipient list (`npub` values)
- message payload content before publish
- per-recipient send attempt
- per-recipient send success/failure
- overall publish summary (`eligible`, `sent`, `failed`)

## File
- `layers/events/server/utils/nostr-notifications.ts`
