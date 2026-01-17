# Initial Prompt
Why is manualIgnoredPrefixes from content/utils/content-route.ts always set to ['/login'], when I set it to more values inside app.config.ts. Looks like app.config.ts is not properly read and parsed through the buildIgnoredPrefixes function

# Implementation Summary
Updated the content layer’s ignored-prefixes Nuxt module to avoid seeding an empty `manualIgnoredPrefixes` array before app config is resolved; it now applies the merged prefixes only when content config exists and during the `app:config` hook. This preserves consumer-defined `manualIgnoredPrefixes` from app.config.ts alongside auto and reserved prefixes, so route middleware and utilities no longer see just `['/login']`.

# Documentation Overview
- `layers/content/utils/ignored-prefixes.server.ts` now guards against clobbering manual prefixes and reapplies the merged list during `app:config`, keeping app-config overrides intact.
- Consumers can rely on `resolveIgnoredPrefixes` to return reserved, auto, and manual prefixes together without losing entries provided in `app.config.ts`.

# Implementation Examples
- With the fix, an app declaring `content.manualIgnoredPrefixes = ['/users', '/admin', '/members', '/builder', '/redir']` in `app.config.ts` will see those entries preserved (alongside `/login` from auth) when `buildIgnoredPrefixes` runs, instead of being reduced to just `/login`.
