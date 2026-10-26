# CouchFusion Core

A Nuxt 4 layer combining CouchDB database access, native sessions, optional login and a system-wide admin workspace. Existing layers remain migration sources; this package has no runtime dependency on them.

## Database-only default

```ts
export default defineNuxtConfig({ extends: ['../../layers/core'] })
```

No login routes, UI, global auth middleware, provisioning or changes follower is installed by default. Core operations are explicit server imports from `#core/server/client` and `#core/server/operations`.

## Password login and administration

```ts
export default defineNuxtConfig({
  extends: ['../../layers/core'],
  couchdb: {
    appSlug: 'my-app',
    config: { enabled: true },
    auth: { enabled: true, password: true, ui: true },
    admin: { enabled: true },
  },
})
```

Render the app through `<NuxtLayout><NuxtPage /></NuxtLayout>`. Session middleware is installed globally and automatically; no host middleware/store is needed. It resolves the incoming native CouchDB cookie before rendering SSR pages, hydrates request-local state, and refreshes protected client navigation. `useCouchDBAuth()` exposes reactive user, settings, loading/error, refresh, loginWithPassword, logout and hasRole.

The sole required external variable for real operations is `COUCHDB_ADMIN_AUTH=base64(username:password)`. It is read at runtime, never embedded in generated client configuration. Bootstrap is `http://localhost:5984`. Use CouchDB `cf_env_<appSlug>` for all further runtime policy/secrets; core build options choose included code. See [configuration](docs/configuration.md).

The default application admin role is `admin`; native server `_admin` is distinct and must be explicitly configured if intended. Every protected API checks caller identity/roles server-side. Cookie-authenticated mutations use same-origin validation and session-bound CSRF tokens consistent across workers.

## Features

- Explicit service/session clients; documents, local docs, bulk writes, views, all-docs, binary attachments, security and design documents.
- Password login, native session API/logout, sanitized user state and role guards.
- Optional email-code adapter, browser-extension Nostr challenges, durable PoW, own-user SSE and Data Sync tooling.
- Optional responsive admin shell with role-filtered typed navigation and title/header-action hooks; no required Tailwind, Pinia, VueUse or icon package.
- All feature defaults false; invalid parent combinations fail setup. `admin.dataSync` requires `admin.enabled`; all auth/admin features require `auth.enabled`.

Email requires an explicit server-only `auth.emailDeliveryHandler` adapter and configured existing token storage. Nostr requires the optional `nostr-tools` peer and an existing `_users` lookup view/link. These methods require the configured native signing secret; no database or server-policy mutation occurs on startup. Provider flows use existing accounts only. This implementation's Nostr UI uses NIP-07 extension signing; relay/DM transport settings retained in the parser are reserved and do not enable a messaging flow. Data Sync single-document JSON copy retains existing attachment-stub limitations; use native database replication for attachment-preserving transfers.

## Verification

```bash
pnpm install
pnpm test
pnpm test:watch
pnpm test:doctor
pnpm test:local
pnpm test:nuxt
pnpm test:matrix
pnpm typecheck
```

The ordinary unit/local loop uses Vitest Node projects without booting Nuxt, a browser or Docker. Only doctor/local checks require the inherited admin variable. Nuxt checks build a temporary fixture extending cf-cloud so they don't overwrite its running dev server. See [testing](docs/testing.md).

Provisioning is separate and explicit: `pnpm provision --config /path/policy.json` is dry-run; add `--apply` to create a named non-system database/designs with explicit security. Policy JSON contains database/security/designs, never credentials. `pnpm preflight --config /path/policy.json` is read-only. Both use the same inherited admin credential and local seed; neither rewrites shared `_users` or native auth policy. Provisioning validates structural input before any request, preserves existing database security, and skips unchanged designs. See [provisioning safety](docs/provisioning.md).
