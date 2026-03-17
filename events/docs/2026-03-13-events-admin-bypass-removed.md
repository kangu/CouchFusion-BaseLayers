# Events Admin Bypass Removed

## Scope
Removed the development auth bypass path for events admin APIs.

## What changed
- Removed `runtimeConfig.events.devAdminBypass` from `layers/events/nuxt.config.ts`.
- Simplified `assertEventsAdminSession` to always call `assertAdminSession`.
- Removed environment sample entry `NUXT_EVENTS_DEV_ADMIN_BYPASS` from `apps/bitvocation/.env.example`.
- Removed obsolete bypass-specific documentation and updated inline editing access notes.

## Result
Events admin APIs now always require a valid admin session in every environment.
