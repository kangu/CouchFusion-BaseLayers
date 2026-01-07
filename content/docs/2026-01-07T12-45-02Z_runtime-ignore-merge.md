# Initial Prompt
Given that I have made a change so that ignore prefixes are coming from nuxt.config's runtimeConfig like so `content: { ignore: ['/ignore_redir_from_app'] }`, update the /Users/radu/Projects/nuxt-apps/layers/content/utils/ignored-prefixes.server.ts file to append the server prefixes to the runtimeConfig.content?.ignore used by buildIgnoredPrefixes in /Users/radu/Projects/nuxt-apps/layers/content/app/middleware/content.global.ts

# Implementation Summary
Updated `layers/content/utils/ignored-prefixes.server.ts` to merge the content layer’s auto- and manual-ignore prefixes into `runtimeConfig.content.ignore`, alongside any runtime-defined ignores. This keeps server/runtime consumers (including buildIgnoredPrefixes) in sync with app-defined ignores without clobbering existing runtime entries.

# Documentation Overview
- The ignored-prefixes module now initializes `runtimeConfig.content.ignore` by combining existing runtime ignores with auto-discovered page prefixes and manual entries from app config. The merged list is sorted and deduped for consistent consumption server-side.
- App config application remains unchanged (applied when present and during `app:config`), but runtimeConfig now surfaces the same ignore set for middleware or server utilities reading from runtime.

# Implementation Examples
- With `runtimeConfig: { content: { ignore: ['/ignore_redir_from_app'] } }` and app-config manual prefixes, `runtimeConfig.content.ignore` becomes the union of runtime ignores, auto-generated page prefixes, and manual ignores, ensuring `buildIgnoredPrefixes` sees all server/app sources.
