# Initial Prompt
The guard works correctly on SSR, but not on client-side navigation, make sure to fix that

# Implementation Summary
Propagated the merged ignored prefixes into `public.runtimeConfig` so client-side middleware receives the same ignore list as SSR. The middleware now merges app-config content with both private and public runtime ignores, preventing client navigations (e.g., `/members/jobs`) from triggering content fetch/404 warnings.

# Documentation Overview
- `layers/content/utils/ignored-prefixes.server.ts` now mirrors the merged ignore list into `runtimeConfig.public.content.ignore` for client access.
- `layers/content/app/middleware/content.global.ts` reads ignore arrays from both runtimeConfig scopes and app config, ensuring consistent skip behavior on client and server.

# Implementation Examples
- With `/members` in `runtimeConfig.content.ignore`, client navigation to `/members/jobs` is now skipped by the content middleware (no fetch, no 404 warning), matching SSR behaviour.
