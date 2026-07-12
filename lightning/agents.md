# Layer: lightning

`Runtime: nuxt 4.x, vue 3.5.x`

Bitcoin Lightning payment layer for Nuxt 4 apps. Provides invoice creation, status polling, webhook handling, and provider abstraction (Strike / Alby / Blink) over a CouchDB-backed persistence model. Consumed by `apps/bitvocation`, `apps/couchfusioncom`, `apps/kangu`, `apps/tulin-delivery` (see each app's `nuxt.config.ts` extends array).

## Folder map
- `composables/` — empty placeholder; client composables intentionally not exposed.
- `providers/` — provider factories: `alby.ts`, `blink.ts`, `strike.ts`. Each exports `create<Name>Provider`.
- `services/lightning.ts` — `createLightningService(config)` provider router/cache.
- `server/api/lightning/` — endpoints: `donation.post.ts`, `purchase.post.ts`, `events.get.ts`, `invoice/[invoiceId].get.ts`.
- `server/api/webhooks/` — `blink.post.ts`, `strike.post.ts` (no Alby webhook route yet).
- `server/composables/useLightning.ts` — server composable wrapping invoice lifecycle.
- `server/plugins/` — `init.ts`, `pending-invoice-expiration.ts`.
- `server/utils/` — `lightning-config.ts`, `payment-event-bus.ts`, `payment-event-log.ts`, `payment-state.ts`, `order-fulfillment.ts`, `pending-invoice-expiration.ts`.
- `types/` — `lightning.ts`, `payment-events.ts`.
- `utils/` — `lightning.ts` (entry helpers), `design-documents.ts`, `orders.ts`.
- `covenant-service/` — vendored external service (node_modules only; treat as opaque).
- `tests/` — vitest specs; see Build/Test below.
- `docs/` — dated implementation notes; start with `2025-08-29-lightning-layer-couchdb-integration.md`.
- `README_alby.md` — Alby PAT setup reference.

## Public API / Exports
- Alias: `#lightning` → layer root (configured in `nuxt.config.ts`).
- Auto-import dirs: `app/composables`, `app/middleware`, `app/stores` (currently empty — nothing auto-imported).
- Server composable: `useLightning()` (from `server/composables/useLightning.ts`).
- Utils (import via `#lightning/utils/...`): `createLightningInvoice`, `checkLightningInvoiceStatus` (`utils/lightning.ts`).
- Service: `createLightningService` (`services/lightning.ts`).
- Providers: `createStrikeProvider`, `createAlbyProvider`, `createBlinkProvider`.
- HTTP endpoints (all under `/api`):
  - `POST /api/lightning/donation`
  - `POST /api/lightning/purchase`
  - `GET  /api/lightning/events`
  - `GET  /api/lightning/invoice/:invoiceId`
  - `POST /api/webhooks/blink`
  - `POST /api/webhooks/strike`

## Conventions
- Route rules force `cors: true` on `/api/**` and `x-powered-by: btc` header — do not strip.
- All provider implementations must satisfy the `LightningProvider` interface in `types/lightning.ts`.
- Provider names are the lowercase string keys `'strike' | 'alby' | 'blink' | 'nwc'`; never invent new keys without updating `LightningConfig` and `services/lightning.ts` switch.
- Invoice currency defaults to `sats`; BTC conversion lives in `providers/strike.ts` (`satsToBtc`) — keep precision at 8 decimals.
- Webhook routes must be idempotent; status transitions go through `server/utils/payment-state.ts`.
- Persisted docs use `type: 'lightning_invoice'` (and related) prefixes; design docs live in `utils/design-documents.ts`.
- TypeScript `strict: true` is enabled — no implicit any.

## Dependencies
- Peer: `nuxt ^4.0.0`.
- Extends layer: `../database` (uses `#database/utils/couchdb` — `getDocument`, `getView`, `bulkDocs`, `putDocument`, `validateCouchDBEnvironment`).
- No other layers imported.
- Consuming app must provide `runtimeConfig.lightning` with `defaultProvider` and `providers.{strike,alby,blink}` (see `README_alby.md`).
- NWC configuration is server-only in CouchDB `_config`: `lightning_default_provider=nwc`, `nwc_connection_uri`, and optional `nwc_reconcile_interval_ms`. The URI is secret material and must never be logged or exposed.
- `crypto` (node builtin) used by Strike provider signature verification.

## Build / Test commands
No standalone lint/typecheck script. Tests run via root vitest config scoped to this layer:

```bash
# from repo root
bunx vitest run --config layers/lightning/vitest.config.ts
# or
npx vitest run layers/lightning/tests
```

Typecheck/lint is performed inside a consuming app (e.g. `apps/bitvocation`):

```bash
cd apps/bitvocation && nuxt typecheck
```

## Gotchas / Pitfalls
- `composables/` dir is empty — don't assume client-side auto-imports exist; the layer is server-only.
- Strike webhook signature uses HMAC SHA-256 — verify against raw body, not parsed JSON.
- `payment-event-bus.ts` uses Nitro hooks (`useStorage`/`hubHooks`); events do not survive restarts unless logged via `payment-event-log.ts`.
- Alby has no webhook route file (`server/api/webhooks/alby.post.ts` missing) despite the provider existing.
- `covenant-service/` is a vendored node_modules bundle — do not edit.
- Polling intervals (`pending-invoice-expiration.ts`) assume single-instance Nitro; multi-instance needs external lock.

## Cross-references
- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/` (dated changelog entries).
- Related layer: `layers/database` (CouchDB primitives).
- Related skills: none specific.
