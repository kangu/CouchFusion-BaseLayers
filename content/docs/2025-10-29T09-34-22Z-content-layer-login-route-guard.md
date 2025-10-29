# Initial Prompt
I have placed the login.vue component under layers/auth/app/pages but it doesn't seem to be picked up as a page from the nuxt-app-starter nuxtjs4 project. Use the playwright mcp server to check http://localhost:6018/login and make necessary changes until the route is reacheable. The idea is to have the login page available by default from the auth layer so every implementing app has its barebones login page.

# Implementation Summary
Excluded the configured auth login path from content-based routing by injecting it into ignored prefixes and shipping an auth-layer plugin to seed manual lists, restoring the shared login.vue page across apps.

# Documentation Overview
- `app/middleware/content.global.ts` now reads `runtimeConfig.public.authLoginPath`, normalises it, and appends it to the ignored prefix list alongside content-driven entries.
- By resolving the login path dynamically, apps that override `authLoginPath` continue to work without additional manual ignored-prefix configuration.
- The middleware still defers to reserved prefixes and content document discovery; only the auth login route is explicitly skipped.

# Implementation Examples
- Default behaviour: with no overrides the middleware automatically excludes `/login`, allowing the auth layer page to render.
- Custom route: set `runtimeConfig.public.authLoginPath = '/signin'` in the consuming app; the middleware excludes `/signin`, while the content builder continues to serve all other slugs.
