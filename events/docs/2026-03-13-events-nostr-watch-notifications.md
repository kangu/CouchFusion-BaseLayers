# Events Nostr Watch Notifications

## Scope
Implemented conference watch/favorite metadata APIs and admin-triggered pre-save Nostr watcher notifications.

## API Additions
- User preference routes (authenticated user):
  - `POST /api/events/conferences/:id/favorite`
  - `DELETE /api/events/conferences/:id/favorite`
  - `POST /api/events/conferences/:id/watch`
  - `DELETE /api/events/conferences/:id/watch`
- Admin update route enhancement:
  - `PATCH /api/events/conferences/:id` now accepts:
    - `notifyWatchers: boolean`
    - `notifyMessage?: string`

## Behavior
- User conference preferences are persisted under `_users` metadata:
  - `conference_prefs.favorites`
  - `conference_prefs.watched`
- When `notifyWatchers === true` on admin patch:
  - watcher list is resolved from auth design-doc view (`watchers_by_conference`),
  - NIP-17 DMs are sent before save,
  - if any DM delivery fails, save is aborted before persistence.

## Notes
- Delivery relies on auth-layer Nostr config resolver from CouchDB `_config` (`cf_env_[slug]`) and configured relay list/sender key.
- Admin editor now includes a notification section with explicit "send before save" toggle.
