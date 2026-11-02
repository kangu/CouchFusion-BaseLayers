# Layer: core

Unified Nuxt 4.6.2 CouchDB integration. Default database-only; features are explicitly registered in module.ts. Read README.md and docs/configuration.md before changing behavior.

- Canonical alias #core -> src/. Database operations are server-only under src/server.
- Do not import old database/auth/admin_workspace layers at runtime.
- Only required environment variable: COUCHDB_ADMIN_AUTH (base64 credentials). Bootstrap localhost:5984. Other runtime settings/secrets come from cf_env_<appSlug>.
- Optional files stay outside Nuxt's automatically scanned app/server directories. No default UI/auth/global middleware/network/provisioning.
- Authentication uses native CouchDB sessions. Never substitute service credentials for caller cookies or implicitly promote _admin to the application's admin role.
- SSR state is scoped to current Nuxt app/H3 event. Middleware is registered globally by the module; hydration reuses state and protected client navigation refreshes it.
- Test with pnpm test, pnpm test:local, pnpm test:nuxt, pnpm test:matrix and pnpm typecheck. Local tests only use exact manifest-owned temporary resources and never modify shared _users design docs or native server policy.
- Admin and login UI use the Terminal theme in src/features/ui-theme (light/dark pair, cf- prefixed classes scoped to .cf-ui); keep new admin pages on its tokens and classes rather than adding a CSS framework.
- Keep documentation under docs/ and results under docs/implementation_results/. Other consumers are not migrated automatically; see docs/migration-inventory.md.
