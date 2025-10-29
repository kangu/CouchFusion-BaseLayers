# Initial Prompt
I have placed the login.vue component under layers/auth/app/pages but it doesn't seem to be picked up as a page from the nuxt-app-starter nuxtjs4 project. Use the playwright mcp server to check http://localhost:6018/login and make necessary changes until the route is reacheable. The idea is to have the login page available by default from the auth layer so every implementing app has its barebones login page.

# Implementation Summary
Excluded the configured auth login path from content-based routing by injecting it into ignored prefixes and shipping an auth-layer plugin to seed manual lists, restoring the shared login.vue page across apps.

# Documentation Overview
- Added an auth-layer plugin (`plugins/ensure-login-ignored-prefix.ts`) that reads the configured login route and ensures it appears in manual/merged ignored prefix arrays so content tooling leaves the path alone.
- Updated the layer Nuxt configuration to register both `register-layer-middleware` and the new ignore-prefix plugin explicitly, guaranteeing they run in any consuming application.
- With these defaults every app extending the auth layer now receives the login page without needing local configuration tweaks.

# Implementation Examples
- Default login routing remains `/login`; to customise, set `runtimeConfig.public.authLoginPath` in the consuming app (for example `'/signin'`). The plugin will insert that path into ignored prefixes automatically.
- After extending the auth layer, visiting `http://localhost:6018/login` (or the configured alternative) renders `layers/auth/app/pages/login.vue` instead of the content 404 screen.
