# PRD: Boltz Liquid Settlement Provider for Lightning Layer

## 1. Summary

Add a `boltz` provider to the CouchFusion `layers/lightning` layer so apps can accept Lightning payments while settling received value into a Liquid wallet through Boltz reverse swaps.

The provider should follow the model used by the Boltz BTCPay Server plugin: the app still asks for a Lightning invoice, but the provider creates a Boltz Lightning -> Liquid reverse swap and returns the swap's BOLT11 invoice as the payment request. When the buyer pays the invoice, Boltz settles to the configured Liquid wallet and the layer marks the existing invoice/order flow as paid.

Production target is Debian. Development target is macOS. Production must not require a separate manual Boltz Client installation; the app deployment must provision, verify, configure, and supervise `boltzd` as part of the app stack.

## 2. Goals

- Add `boltz` as a first-class `LightningProvider` option alongside `strike`, `alby`, and `blink`.
- Support receive-only Lightning invoices settled to Liquid L-BTC.
- Preserve the existing purchase and donation API shape.
- Persist Boltz swap metadata inside the existing CouchDB invoice document model.
- Keep order fulfillment, payment events, SSE notifications, invoice links, and invoice status reads compatible with the current layer.
- Provide a Debian deployment path with app-owned Boltz Client provisioning.
- Provide macOS development options that do not require native Boltz Client binaries.

## 3. Constraints And Non-Goals

Constraints:

- v1 supports single-instance Nitro only. Multi-instance deployments require an external lock or queue for status transitions and are out of scope.
- v1 must not start multiple `boltzd` processes against the same data directory.
- v1 status transitions must be idempotent and must use the same fulfillment helpers as Strike/Blink.
- v1 must use `sats` only as the app-facing currency.

Non-goals:

- No Lightning payouts.
- No channel rebalancing or autoswap management.
- No Liquid wallet UI in the app.
- No direct implementation of Boltz swap cryptography inside Nuxt.
- No support for arbitrary Liquid assets or stablecoins.
- No multi-tenant wallet management beyond one configured wallet id per app/environment.

## 4. Background

BTCPay's Liquid bridge is implemented by the Boltz BTCPay plugin, not by BTCPay core. The plugin registers a Lightning connection handler and returns an `ILightningClient` implementation. BTCPay core then keeps using its normal Lightning invoice flow. In standalone mode, the plugin creates a reverse swap for `BTC -> LBTC`, returns the generated BOLT11 invoice, and maps swap states back to Lightning invoice states.

Boltz Client is composed of:

- `boltzd`: a long-running daemon exposing a gRPC interface.
- `boltzcli`: CLI client for that gRPC interface.

Boltz Client publishes Linux `amd64` and `arm64` binaries from GitHub releases. Docker is available as a fallback. Source builds require Go, Rust, and a C compiler. That makes a managed Linux binary deployment feasible for Debian, while macOS development should use Docker, mocks, or a remote `boltzd`.

The upstream gRPC source exists at:

- `BoltzExchange/boltz-client/pkg/boltzrpc/boltzrpc.proto`

## 5. Users And Use Cases

Primary users:

- Site operators who want to accept Lightning payments without custodying funds at Strike/Blink/Alby.
- CouchFusion apps already using the lightning layer for purchases, donations, or invoice-link workflows.

Core flow:

1. Buyer purchases a product using a Lightning invoice.
2. App creates a Boltz reverse swap and returns a BOLT11 invoice.
3. Buyer pays the invoice.
4. Boltz settles funds to the configured Liquid wallet.
5. Existing invoice/order flow transitions to `paid` and fulfillment runs.

Operational flow:

1. Deploy app to Debian.
2. Deployment provisions a pinned, verified Boltz Client binary.
3. Deployment installs or updates an app-owned systemd sidecar for `boltzd`.
4. Nuxt talks to `boltzd` over localhost gRPC.

Development flow:

1. Run normal app tests with a mocked Boltz adapter.
2. Run integration tests on macOS against Dockerized `boltzd` or a remote test daemon.

## 6. Product Requirements

### 6.1 Provider Behavior

- Provider key is `boltz`.
- `createInvoice` accepts only `currency: "sats"` in v1.
- `createInvoice` creates a Boltz reverse swap for `BTC -> LBTC`.
- `createInvoice` returns an `InvoiceResponse` with:
  - `invoiceId`: Boltz swap id.
  - `id`: same as `invoiceId`.
  - `paymentRequest`: BOLT11 invoice from the reverse swap.
  - `amount`: BOLT11 invoice amount in sats.
  - `currency`: `sats`.
  - `status`: `pending`.
  - `provider`: `boltz`.
  - `expiresAt`: BOLT11 invoice expiry when available.
  - `paymentContext`: typed Boltz metadata.
- `getInvoiceStatus(invoiceId)` queries Boltz swap state by swap id and maps it into the layer status vocabulary.
- `processWebhook` is a no-op in v1, matching the current Alby situation where the provider exists without a webhook route. Boltz status changes are owned by the poller.

### 6.2 Amount And Fee Semantics

Money correctness must be explicit because reverse swaps can expose order amount, invoice amount, service fee, on-chain fee, and Liquid settlement amount.

Definitions:

- `orderAmountSats`: product/donation amount requested by the app.
- `invoiceAmountSats`: amount encoded in the BOLT11 invoice and paid by the buyer.
- `settlementAmountSats`: Liquid-side amount received after Boltz/on-chain fees, when known.
- `serviceFeeSats`: Boltz service fee, when exposed.
- `onchainFeeSats`: Liquid claim/on-chain fee, when exposed.

Requirements:

- `InvoiceResponse.amount` must be `invoiceAmountSats`, because current payment screens and invoice reads treat `amount` as the amount to pay.
- `paymentContext.orderAmountSats` must preserve the original order amount.
- `paymentContext.invoiceAmountSats` must duplicate the BOLT11 amount for accounting clarity.
- `paymentContext.settlementAmountSats`, `serviceFeeSats`, and `onchainFeeSats` must be stored when Boltz returns them.
- Fulfillment must not be based on a raw amount comparison after creation. Fulfillment is valid when the exact persisted swap id reaches a paid/successful terminal state.
- The purchase route must perform a Boltz amount/limit preflight before `createOrder` to avoid creating orphan orders for amounts Boltz cannot quote.

If Boltz returns a BOLT11 amount different from the requested order amount, the invoice may still be created, but the difference must be visible in `paymentContext` and logs. Product accounting can then decide whether fees are paid by the buyer or absorbed by settlement.

### 6.3 Status Vocabulary

Current code has an internal mismatch:

- `NormalizedPaymentStatus` includes `failed`.
- `InvoiceResponse.status` and `PaymentInfo.status` do not include `failed`.

v1 decision: widen the public status types to include `failed`.

Required type changes:

- `types/lightning.ts`: `InvoiceResponse.status`.
- `server/composables/useLightning.ts`: `PaymentInfo.status`.
- any shared status aliases introduced during implementation.
- `types/payment-events.ts`: add `boltz` to `PaymentProvider` and add an `invoice.failed` event type if the poller emits failure events.

Initial Boltz mapping:

| Boltz state family | Layer status |
| --- | --- |
| created / pending / invoice pending | `pending` |
| successful / completed / settled | `paid` |
| invoice expired / swap expired | `expired` |
| cancelled before payment | `cancelled` |
| refunded / error / server error / settlement failed | `failed` |

`refunded` maps to `failed`, not `cancelled`, because the buyer paid and settlement failed or was unwound. `cancelled` is reserved for a state where the payment was not completed.

The exact upstream enum/string names must be validated against the generated gRPC bindings during implementation.

### 6.4 Persistence

The existing invoice document remains the canonical app-level payment record.

Boltz-specific data is stored under existing flexible structures:

```ts
invoiceData: {
  provider: "boltz",
  invoiceId: "<swap-id>",
  paymentRequest: "<bolt11>",
  amount: 102000,
  status: "pending",
  paymentContext: {
    kind: "boltz-reverse-swap",
    swapId: "<swap-id>",
    pair: { from: "BTC", to: "LBTC" },
    walletId: "<configured-wallet-id>",
    orderAmountSats: 100000,
    invoiceAmountSats: 102000,
    settlementAmountSats?: 99000,
    serviceFeeSats?: 1000,
    onchainFeeSats?: 2000,
    claimAddress?: "<liquid-address>",
    claimTransactionId?: "<liquid-txid>",
    boltzStatus?: "<raw-state>"
  }
}
```

Add a `BoltzPaymentContext` interface in `types/lightning.ts`. Keep `InvoiceResponse.paymentContext` flexible for existing providers, but make the Boltz provider and poller use the typed context internally.

### 6.5 CouchDB Views

The current `by_provider` and `by_provider_and_status` design-doc views read `doc.provider` and `doc.status`. Current invoice docs commonly store the provider under `doc.invoiceData.provider`; status may live in `doc.status`, `doc.payment.status`, or `doc.invoiceData.status`.

v1 must repair or replace these views before adding the Boltz poller.

Required view behavior:

```js
var provider = doc.provider || (doc.invoiceData && doc.invoiceData.provider) || (doc.payment && doc.payment.provider);
var status = doc.status || (doc.payment && doc.payment.status) || (doc.invoiceData && doc.invoiceData.status);
```

Required query for the Boltz poller:

- view: `lightning/by_provider_and_status`
- key: `["boltz", "pending"]`
- `include_docs: true`

This avoids scanning all pending invoices from all providers on every Boltz poll.

### 6.6 Payment Event Flow

Boltz must use the same state transition and fulfillment helpers as Strike/Blink:

- `applyInvoicePaymentStatus`
- `applyInvoicePaidFulfillment`
- payment event log helpers
- payment event bus for SSE
- invoice-link update helpers used by the paid fulfillment path

Creation remains on the current purchase path:

- `applyInvoiceCreatedFulfillment` after invoice persistence.

Paid/terminal transitions are owned by the Boltz status poller in v1.

The poller must:

- load pending Boltz invoice docs via `by_provider_and_status`;
- call `getInvoiceStatus(swapId)`;
- skip unchanged `pending` invoices;
- apply terminal transitions exactly once;
- call `applyInvoicePaidFulfillment` only for `paid`;
- publish/log `invoice.expired`, `invoice.cancelled`, or `invoice.failed` events for terminal non-paid states if the event vocabulary supports them;
- tolerate repeated poll runs without duplicate fulfillment.

### 6.7 Interaction With Existing Expiration Heartbeat

The existing hourly pending-invoice expiration heartbeat expires any pending invoice older than one hour. Boltz reverse swaps have provider-owned expiry and settlement states, so the generic heartbeat must not race the Boltz poller.

v1 decision:

- Boltz invoices are exempt from the generic one-hour expiration heartbeat.
- The Boltz poller is the only component allowed to move a Boltz invoice to `expired`, `cancelled`, `failed`, or `paid`.
- The generic expiration helper should skip docs where resolved provider is `boltz`.

This avoids a paid-but-still-settling swap being marked expired by the generic heartbeat.

## 7. Configuration

Configuration uses CouchDB `_config` via `cf_env_[slug]`, matching current lightning-layer conventions.

New keys:

- `lightning_default_provider=boltz`
- `boltz_grpc_url`
- `boltz_macaroon_path`
- `boltz_cert_path`
- `boltz_wallet_id`
- `boltz_allow_insecure`
- `boltz_network` (`mainnet`, `testnet`, `regtest`; default `mainnet`)
- `boltz_binary_mode` (`managed`, `external`; default `managed` on Linux)
- `boltz_data_dir` (default `/var/lib/<app>/boltz`)
- `boltz_version` (pinned release version used by managed mode)
- `boltz_poll_interval_ms` (default implementation decision; must be documented with the poller)

Do not store macaroon bytes, cert PEM, wallet mnemonic, or seed material directly in CouchDB config in v1. CouchDB config stores paths and non-secret runtime choices.

Required when selected provider is `boltz`:

- `boltz_wallet_id`
- `boltz_grpc_url`
- `boltz_macaroon_path`, unless the daemon is configured without macaroons in local development
- `boltz_cert_path`, unless `boltz_allow_insecure=true` in non-production

`boltz_binary_mode=managed` means the app deployment provisions and supervises `boltzd`.

`boltz_binary_mode=external` means an operator-provided daemon already exists, and the app only uses gRPC config. If `lightning_default_provider=boltz` and a required external connection value is missing, startup config validation fails.

## 8. gRPC Client Strategy

This is a load-bearing implementation decision.

v1 decision:

- Vendor `pkg/boltzrpc/boltzrpc.proto` from a pinned `BoltzExchange/boltz-client` tag that matches `boltz_version`.
- Commit the vendored proto under the lightning layer, for example `server/proto/boltzrpc.proto`.
- Generate a TypeScript client during development and commit the generated output, for example `server/generated/boltzrpc.ts`.
- Use `@grpc/grpc-js` as the runtime transport.
- Use `ts-proto` for generation, configured for grpc-js-compatible services.
- Do not fetch proto files at Nuxt build time or production startup.
- Do not rely on gRPC reflection or a JSON transcoder for v1.

Rationale:

- The adapter needs typed request/response surfaces and streaming support.
- `GetSwapInfoStream` exists in the generated Go gRPC service, so the proto is the stable contract to target.
- Vendoring avoids build-time network dependencies and makes tests deterministic.

Implementation requirements:

- Add a script such as `scripts/generate-boltz-grpc.mjs` or package script documentation for regenerating from the vendored proto.
- Include a README note with the upstream tag and proto source path.
- Add tests that mock the generated client interface, not raw HTTP.
- Adapter timeouts, retries, metadata/macaroons, and TLS credentials belong in `providers/boltz-client-adapter.ts`.

## 9. Deployment Requirements

### 9.1 Production Debian

Production should use an app-owned systemd sidecar:

- `boltzd` runs as a dedicated non-root `boltz` or `<app>-boltz` system user.
- The Nuxt app runs as its normal app user.
- The Boltz wallet/data directory is owned by the Boltz daemon user, not by the Nuxt app user.
- The Nuxt app receives only the minimum client credential material needed to call gRPC.

Suggested paths:

- binaries:
  - `/opt/<app>/vendor/boltz-client/<version>/boltzd`
  - `/opt/<app>/vendor/boltz-client/<version>/boltzcli`
- daemon data:
  - `/var/lib/<app>/boltz`
- client credentials for Nuxt:
  - `/etc/<app>/boltz-client/client.macaroon`
  - `/etc/<app>/boltz-client/tls.cert`

Suggested permissions:

- `/var/lib/<app>/boltz`: owned by daemon user, mode `0700`.
- client credential files: owned by root or daemon user, group-readable by the Nuxt app group if needed, mode `0640`.
- deployment must never make the wallet seed directory readable by the Nuxt app if a narrower client credential copy is sufficient.

### 9.2 Release Verification

Managed deployment must verify release artifacts before installing.

Current Boltz release verification flow publishes:

- `boltz-client-manifest-<version>.txt`
- `boltz-client-manifest-<version>.txt.sig`
- release archives such as `boltz-client-linux-amd64-<version>.tar.gz`

Verification requirements:

- import or pin the Boltz signing key from `https://boltz.exchange/static/boltz.asc`;
- require the primary key fingerprint `8918 FFBF FB49 E93E F256 D930 542A 7F22 A3BD 9CB0` unless Boltz documents a rotated key;
- verify the manifest signature with GPG;
- verify the downloaded archive hash with `sha256sum --ignore-missing -c`;
- refuse to install if signature or hash verification fails.

### 9.3 Deployment Invocation

The layer does not currently have a `scripts/` directory. The implementation may add one, but the install script is a deployment/provisioning step, not a Nuxt build step.

Required invocation model:

- Consuming app deployment calls the provision script before restarting Nuxt.
- The script is idempotent.
- The script installs or validates the pinned binary version.
- The script writes or updates the systemd unit.
- The script reloads systemd and restarts only the Boltz sidecar when binary/config changed.

Do not run binary download/install during `nuxt prepare`, normal dev server startup, or production request handling.

### 9.4 Runtime Options

#### Option A: Managed Child Process Inside Nuxt

Nitro starts `boltzd` with `child_process.spawn`.

Use only for local experiments. It couples daemon lifecycle to Nitro, makes shutdown harder, and can start multiple daemons under multi-instance deployments.

#### Option B: App-Owned systemd Sidecar Unit

The app deployment owns the `boltzd` binary and writes a systemd unit such as `<app>-boltz.service`.

Recommended for Debian production.

#### Option C: Bundled Docker Container

Run `boltz/boltz-client:<pinned-version>` as a container sidecar.

Recommended for macOS integration development and optional production fallback only when Docker is already part of the deployment standard.

## 10. Architecture

### 10.1 Components To Add Or Change

- `types/lightning.ts`
  - Add `LightningProviderName = "strike" | "alby" | "blink" | "boltz"`.
  - Add `LightningInvoiceStatus = "pending" | "paid" | "expired" | "cancelled" | "failed"`.
  - Add `BoltzConfig`.
  - Add `BoltzPaymentContext`.
  - Use shared provider/status aliases in `InvoiceResponse` and `LightningConfig`.
- `types/payment-events.ts`
  - Add `boltz` to `PaymentProvider`.
  - Add `invoice.failed` if terminal failed events are emitted.
- `server/composables/useLightning.ts`
  - Use shared provider/status aliases for `PaymentOptions` and `PaymentInfo`.
- `utils/lightning.ts`
  - Use shared provider alias in `CreateInvoiceOptions` and `checkLightningInvoiceStatus`.
- `server/api/lightning/donation.post.ts`
  - Add `boltz` to request provider typing.
- `services/lightning.ts`
  - Instantiate `createBoltzProvider`.
- `providers/boltz.ts`
  - Implements `LightningProvider`.
  - Wraps the adapter and status mapper.
- `providers/boltz-client-adapter.ts`
  - Owns generated gRPC client calls, TLS, macaroon metadata, retries, and timeout behavior.
- `server/proto/boltzrpc.proto`
  - Vendored upstream proto pinned to `boltz_version`.
- `server/generated/boltzrpc.ts`
  - Generated TypeScript client/types.
- `server/utils/lightning-config.ts`
  - Reads and validates Boltz CouchDB config keys.
  - Extends `PROVIDERS`, `PROVIDER_SOURCE_PATHS`, and `normalizeProvider`.
- `utils/design-documents.ts`
  - Fix provider/status views to resolve nested invoice provider/status fields.
- `server/plugins/pending-invoice-expiration.ts`
  - Skip Boltz invoices in the generic stale pending heartbeat.
- `server/plugins/boltz-status-poller.ts`
  - Polls pending Boltz invoices and persists state transitions.
- `server/api/lightning/boltz/health.get.ts`
  - Optional admin-only health endpoint.
- `scripts/provision-boltz-client.mjs`
  - Optional layer-provided deployment script for downloading, verifying, installing, and writing the sidecar unit.

### 10.2 Data Flow

Invoice creation:

1. Purchase route resolves app payload and requested sats.
2. If default/requested provider is `boltz`, route performs a provider amount/limits preflight before `createOrder`.
3. Route creates the order.
4. Route calls `useLightning().createPayment`.
5. Boltz provider calls `CreateReverseSwap` over gRPC.
6. Provider returns BOLT11 invoice and swap id.
7. Existing `saveInvoiceToDatabase` stores invoice document.
8. Existing `applyInvoiceCreatedFulfillment` runs.

Payment settlement:

1. Buyer pays BOLT11.
2. Boltz swap reaches a terminal or intermediate state.
3. Boltz poller queries pending Boltz invoices via `by_provider_and_status`.
4. Poller calls provider `getInvoiceStatus(swapId)`.
5. Poller applies changed terminal states with `applyInvoicePaymentStatus`.
6. If paid, poller calls `applyInvoicePaidFulfillment`.
7. Poller logs and publishes payment events/SSE updates.

## 11. Error Handling

Provider errors:

- gRPC unavailable: invoice creation fails with a 503-style error.
- amount below/above Boltz limits: purchase preflight fails before `createOrder`.
- wallet missing: startup health fails and invoice creation fails.
- swap creation succeeds but invoice persistence fails: log swap id, invoice, and order metadata for manual reconciliation.

Status errors:

- temporary gRPC failure: poller logs warning and retries later.
- swap not found: keep pending for a short grace window; mark `failed` only after repeated misses.
- terminal provider error: mark invoice `failed`.
- refunded swap: mark invoice `failed`.

Operational errors:

- managed binary missing: provider not ready; startup logs actionable provisioning instructions.
- signature/hash verification failure: provisioning aborts.
- multiple daemons for same data dir: provisioning or daemon startup must prevent this via systemd singleton and file locking.

## 12. Security Requirements

- Do not log macaroons, cert contents, wallet mnemonics, seeds, or full config values.
- Verify downloaded Boltz Client releases before using binaries.
- Pin the Boltz Client version; do not default production to unpinned `latest`.
- Run `boltzd` as a non-root daemon user.
- Bind gRPC to localhost by default.
- Use TLS/cert validation unless `boltz_allow_insecure=true` in non-production.
- Keep wallet data unreadable by the Nuxt app when possible.
- Keep health endpoints admin-gated. They must not be public `/api/**` diagnostics despite global CORS route rules.
- Avoid direct swap cryptography in Nuxt v1; delegate claim/refund lifecycle to Boltz Client.

## 13. Observability

Logs:

- provider initialization with masked config status;
- Boltz Client version and binary verification result;
- swap creation success/failure;
- amount/fee fields returned by Boltz;
- status poll transitions;
- gRPC connectivity failures;
- fulfillment result.

Metrics/counters:

- created Boltz invoices;
- pending Boltz invoices;
- paid/expired/cancelled/failed transitions;
- poller failures;
- daemon health status.

Admin health endpoint:

- must require admin authentication;
- reports provider configured;
- reports gRPC reachable;
- reports `boltzd` version;
- reports whether wallet id is configured, not the wallet id value unless admin UI explicitly needs it;
- reports last successful status poll timestamp.

## 14. Testing Requirements

Unit tests:

- config resolver reads Boltz keys from CouchDB config.
- config validation requires Boltz keys only when provider is `boltz`.
- provider union/status aliases include `boltz` and `failed` in all public surfaces.
- provider maps reverse swap creation into `InvoiceResponse`.
- provider maps Boltz states into layer statuses.
- refunded maps to `failed`.
- provider rejects non-sats currency.
- service factory registers `boltz`.
- design-doc provider/status views resolve nested `invoiceData.provider`.
- generic pending expiration skips Boltz invoices.

Adapter tests:

- generated client interface is mocked.
- unary calls include macaroon metadata when configured.
- TLS/insecure options map from config.
- transient gRPC errors are retried or surfaced according to adapter policy.

Integration-style tests with mocks:

- purchase route performs Boltz amount preflight before `createOrder`.
- purchase route works with `lightning_default_provider=boltz`.
- saved invoice doc contains `provider: boltz` and typed swap metadata.
- poller updates a pending invoice to paid.
- paid transition triggers existing fulfillment/event paths.
- transient gRPC errors do not mark invoices failed.

Deployment tests:

- provision script selects correct Linux architecture.
- GPG signature failure aborts.
- SHA256 mismatch aborts.
- generated systemd unit uses daemon user, data dir, binary path, and localhost gRPC config.

Manual QA:

- macOS Docker/regtest flow can create and settle a test swap.
- Debian staging can create a purchase invoice, pay it, and observe:
  - invoice doc paid;
  - order fulfilled;
  - user/product entitlement updated;
  - SSE event received;
  - Liquid settlement visible in Boltz wallet.

## 15. Rollout Plan

Phase 1: PRD and implementation plan.

Phase 2: Type/config groundwork.

- Add shared provider/status aliases.
- Add `BoltzConfig` and `BoltzPaymentContext`.
- Extend provider unions across `types/lightning.ts`, `types/payment-events.ts`, `server/composables/useLightning.ts`, `utils/lightning.ts`, and `donation.post.ts`.
- Add config keys and validation.

Phase 3: gRPC adapter foundation.

- Vendor pinned `boltzrpc.proto`.
- Generate and commit TS bindings.
- Build adapter against mocked generated client.
- Add Dockerized `boltzd` integration target for adapter validation before deployment scripts.

Phase 4: provider skeleton and invoice creation.

- Implement `createBoltzProvider`.
- Add service factory registration.
- Add amount/limits preflight.
- Persist typed payment context.

Phase 5: persistence and status transitions.

- Fix CouchDB provider/status views.
- Add Boltz status poller.
- Exempt Boltz from generic expiration.
- Wire paid fulfillment and events.

Phase 6: Debian provisioning.

- Add idempotent provision script.
- Add systemd sidecar template.
- Add release verification with pinned signing key fingerprint.

Phase 7: staging validation with real Boltz Client.

Phase 8: optional gRPC streaming listener and richer admin diagnostics.

Consuming apps:

- No page/schema migration is expected for apps extending the layer.
- Apps must opt in by adding CouchDB config for `lightning_default_provider=boltz` and Boltz-specific keys.
- Apps not using Boltz should remain unaffected.

## 16. Open Decisions

- Whether fees are buyer-paid or settlement-absorbed for each product line. The provider stores both values either way.
- Whether the app should ever initialize/import the Boltz wallet automatically, or require an operator-created wallet id for v1.
- Whether failed terminal states should publish a new `invoice.failed` SSE event in v1 or only persist failed state.
- Exact poll interval and stale retry policy.
- Whether production deployments will ever need multi-instance Nitro; if yes, add external locking before enabling Boltz poller on more than one instance.

## 17. Recommended Decisions

- Do not commit binaries into the git repository.
- Pin a Boltz Client version and fetch verified release artifacts in deployment.
- Use an app-owned systemd sidecar for `boltzd` on Debian.
- Run `boltzd` under a dedicated daemon user, not the Nuxt app user.
- Use Docker or mocks on macOS.
- Require an already initialized Boltz wallet id for v1.
- Store secret material on disk and keep only paths/references in CouchDB config.
- Start with polling; add `GetSwapInfoStream` after the provider is stable.

## 18. Source References

- Boltz Client docs: `https://client.docs.boltz.exchange/`
- Boltz Client gRPC proto: `https://github.com/BoltzExchange/boltz-client/blob/master/pkg/boltzrpc/boltzrpc.proto`
- Boltz Client releases: `https://github.com/BoltzExchange/boltz-client/releases`
- Boltz release signing key: `https://boltz.exchange/static/boltz.asc`
- Boltz Client Go module: `https://pkg.go.dev/github.com/BoltzExchange/boltz-client/v2`
- Boltz BTCPay plugin: `https://github.com/BoltzExchange/boltz-btcpay-plugin`
- BTCPay core Lightning handler: `https://github.com/btcpayserver/btcpayserver/blob/master/BTCPayServer/Payments/Lightning/LightningLikePaymentHandler.cs`
