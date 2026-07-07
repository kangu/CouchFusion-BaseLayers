# PRD: Boltz Liquid Settlement Provider for Lightning Layer

## 1. Summary

Add a `boltz` provider to the CouchFusion `layers/lightning` layer so applications can accept Lightning payments while settling received value into a Liquid wallet through Boltz reverse swaps.

The provider should follow the model used by the Boltz BTCPay Server plugin: the application still asks for a Lightning invoice, but the provider creates a Boltz Lightning -> Liquid reverse swap and returns the swap's BOLT11 invoice as the payment request. When the buyer pays the invoice, Boltz claims the swap to the configured Liquid wallet and the layer marks the invoice/order as paid.

Production deployment target is Debian. Development target is macOS. The production deployment should not require a manual, separate Boltz Client installation; the application deployment should own, provision, verify, configure, and run `boltzd` as part of the app stack.

## 2. Goals

- Add `boltz` as a first-class `LightningProvider` option alongside `strike`, `alby`, and `blink`.
- Support receive-only Lightning invoices settled to Liquid L-BTC.
- Preserve the existing public API surface for purchase and donation flows.
- Persist swap metadata in the existing CouchDB invoice document model.
- Keep order fulfillment, payment events, SSE notifications, and invoice status polling compatible with the current layer.
- Provide a deployment path where production Debian machines do not need a manually installed `boltzd` or `boltzcli`.
- Make macOS development practical even though official Boltz Client binaries are Linux-focused.

## 3. Non-Goals

- No Lightning payouts in v1.
- No channel rebalancing or autoswap management in v1.
- No Liquid wallet UI in the app in v1.
- No direct implementation of Boltz swap cryptography inside the Nuxt layer.
- No support for arbitrary assets or stablecoins in v1.
- No multi-tenant wallet management in v1 beyond one configured wallet id per app/environment.

## 4. Background

BTCPay's Liquid bridge is implemented by the Boltz BTCPay plugin, not by BTCPay core. The plugin registers a Boltz Lightning connection handler and returns an `ILightningClient` implementation. BTCPay core then keeps using its normal Lightning invoice flow. In standalone mode, the plugin creates a Boltz reverse swap with pair `BTC -> LBTC`, returns the generated BOLT11 invoice, and maps swap states back to Lightning invoice states.

Boltz Client is composed of:

- `boltzd`: a long-running daemon exposing a gRPC interface.
- `boltzcli`: CLI client for that gRPC interface.

Boltz Client documentation states that Linux `amd64` and `arm64` binaries are available from GitHub releases, Docker is available as a fallback, and source builds require Go, Rust, and a C compiler. That makes a bundled Linux binary deployment feasible for Debian, while macOS development should use Docker or provider mocks rather than native `boltzd`.

## 5. Users And Use Cases

Primary users:

- Site operators who want to accept Lightning payments without custodying funds at Strike/Blink/Alby.
- CouchFusion apps that already use the lightning layer for product purchases, donations, or invoice-link workflows.

Core use cases:

- Buyer purchases a product using a Lightning invoice.
- App creates a Boltz reverse swap and returns a BOLT11 invoice.
- Buyer pays the invoice.
- Boltz settles the funds to the configured Liquid wallet.
- The existing order/invoice flow transitions to `paid` and fulfillment runs.

Operational use cases:

- Deploy app to Debian and have `boltzd` provisioned by the app deployment.
- Run app locally on macOS with a mock provider, Dockerized Boltz Client, or remote `boltzd`.
- Rotate Boltz Client versions in a controlled, verifiable way.

## 6. Product Requirements

### 6.1 Provider Behavior

- The provider key must be `boltz`.
- The provider must accept only `currency: "sats"` in v1.
- `createInvoice` must create a Boltz reverse swap for `BTC -> LBTC`.
- The returned `InvoiceResponse` must include:
  - `invoiceId`: Boltz swap id.
  - `id`: same as `invoiceId`.
  - `paymentRequest`: BOLT11 invoice from the reverse swap.
  - `amount`: requested sats amount, or provider-confirmed invoice amount when available.
  - `currency`: `sats`.
  - `status`: `pending`.
  - `provider`: `boltz`.
  - `expiresAt`: BOLT11 expiry when available.
  - `paymentContext`: swap metadata required for diagnostics and status updates.
- `getInvoiceStatus(invoiceId)` must query Boltz swap state by swap id and map it into the layer's status vocabulary.
- `processWebhook` may be a no-op in v1 if status updates are handled by polling or gRPC streaming.

### 6.2 Status Mapping

Initial status mapping:

| Boltz state | Layer status |
| --- | --- |
| pending / created / invoice pending | `pending` |
| successful | `paid` |
| invoice expired / swap expired | `expired` |
| refunded / cancelled | `cancelled` |
| error / server error | `failed` |

The exact state names should be aligned with the gRPC bindings used during implementation.

### 6.3 Persistence

The existing invoice document must remain the canonical app-level payment record.

Add Boltz-specific fields under existing flexible structures:

```ts
invoiceData: {
  provider: "boltz",
  invoiceId: "<swap-id>",
  paymentRequest: "<bolt11>",
  status: "pending",
  paymentContext: {
    swapId: "<swap-id>",
    pair: { from: "BTC", to: "LBTC" },
    walletId: "<configured-wallet-id>",
    expectedAmount?: number,
    serviceFee?: number,
    onchainFee?: number,
    claimAddress?: string,
    claimTransactionId?: string
  }
}
```

Add or update CouchDB views only if implementation needs efficient queries by swap id beyond the existing `by_invoice_id` view. Because `invoiceId` will be the swap id, `by_invoice_id` should usually be sufficient.

### 6.4 Payment Event Flow

The provider must eventually call the same state transition helpers used by Strike/Blink routes:

- `applyInvoicePaymentStatus`
- order fulfillment helpers
- payment event log
- payment event bus for SSE
- invoice-link updates

Since Boltz does not naturally fit the existing incoming webhook model, v1 needs one of:

- a provider poller that checks pending `boltz` invoices and persists transitions, or
- a `boltzd` gRPC stream listener that persists transitions as swap updates arrive.

Recommended v1: implement polling first, then add streaming as an optimization. Polling is easier to test, survives process restarts, and fits the current pending invoice expiration pattern.

### 6.5 Configuration

Configuration must use CouchDB `_config` via `cf_env_[slug]`, matching current lightning-layer conventions.

New keys:

- `lightning_default_provider=boltz`
- `boltz_grpc_url`
- `boltz_macaroon`
- `boltz_cert_path` or `boltz_cert_pem`
- `boltz_wallet_id`
- `boltz_allow_insecure`
- `boltz_network` (`mainnet`, `testnet`, `regtest`; default `mainnet`)
- `boltz_binary_mode` (`managed`, `external`, `disabled`; default `managed` on Linux)
- `boltz_data_dir` (default app-controlled runtime data directory)
- `boltz_version` (pinned release version used by managed mode)

Required when selected provider is `boltz`:

- `boltz_wallet_id`
- one usable daemon connection, either managed daemon config or external gRPC config.

Macaroon and certificate may be generated by managed mode and then stored in CouchDB config or an app-owned secret file, depending on deployment choice.

## 7. Deployment Requirements

### 7.1 Production Debian

Production should support an app-owned managed Boltz Client:

- The app release artifact includes or can download a pinned `boltzd` and `boltzcli` Linux binary for the server architecture.
- The deployment verifies the release manifest signature and SHA256 hash before first use.
- The binary is placed in an app-owned directory such as:
  - `/opt/<app>/vendor/boltz-client/<version>/boltzd`
  - `/opt/<app>/vendor/boltz-client/<version>/boltzcli`
- Runtime data lives outside the immutable app release:
  - `/var/lib/<app>/boltz`
- Secrets have restrictive permissions:
  - owned by the app service user
  - mode `0600` for macaroons/certs
  - mode `0700` for data dir

### 7.2 Embedded Runtime Options

The PRD evaluates three embedding options.

#### Option A: Managed Child Process Inside Nuxt

The Nitro server starts `boltzd` using `child_process.spawn` from a server plugin and stops it on shutdown.

Pros:

- Single service from the operator perspective.
- No separate systemd unit.
- Easy local process supervision from app code.

Cons:

- Long-running daemon lifecycle is tied to Nitro restart behavior.
- Multi-instance deployment can accidentally start multiple daemons against the same data dir.
- Harder to inspect and restart independently.
- A hung `boltzd` can complicate app shutdown.

Use only for development or very small single-instance deployments.

#### Option B: App-Owned systemd Sidecar Unit

The app deployment owns the `boltzd` binary and writes/updates a systemd unit such as `<app>-boltz.service`. The app does not require the operator to install Boltz Client manually; it provisions it as part of deployment.

Pros:

- Production-grade process supervision.
- Independent logs, restart policy, resource limits, and health checks.
- Avoids tying daemon lifecycle to Nitro restarts.
- Still satisfies "no separate manual install" because deployment owns provisioning.

Cons:

- Requires deployment script/systemd integration.
- Slightly more moving parts than a child process.

Recommended production approach.

#### Option C: Bundled Docker Container

Deployment starts `boltz/boltz-client:<pinned-version>` as a container sidecar.

Pros:

- Works on platforms without native binaries.
- Good for macOS development.

Cons:

- Requires Docker in production.
- Harder to treat as fully embedded in a plain Debian/systemd deployment.
- Adds container operational assumptions.

Recommended for macOS development and optional production fallback, not the default Debian path.

### 7.3 Recommended Deployment Decision

Use Option B for Debian production:

- app deployment downloads or ships verified Linux binaries;
- app deployment generates a systemd sidecar unit;
- Nuxt provider talks to `boltzd` over localhost gRPC;
- app health endpoints check both provider config and daemon connectivity.

Use Option C or provider mocks on macOS development:

- Dockerized `boltzd` for integration work;
- mocked provider for normal application tests;
- no requirement for native macOS Boltz Client binaries.

## 8. Architecture

### 8.1 Components

- `types/lightning.ts`
  - Add `BoltzConfig`.
  - Extend provider union types with `boltz`.
- `providers/boltz.ts`
  - Implements `LightningProvider`.
  - Wraps a Boltz gRPC adapter.
- `providers/boltz-client-adapter.ts`
  - Isolates gRPC transport, protobuf types, timeouts, retries, and state mapping.
- `services/lightning.ts`
  - Instantiates `createBoltzProvider`.
- `server/utils/lightning-config.ts`
  - Reads Boltz CouchDB config keys.
  - Validates required Boltz config only when selected provider is `boltz`.
- `server/utils/boltz-managed-runtime.ts`
  - Handles managed binary discovery, verification metadata, and health checks.
  - Does not start a production daemon itself when systemd sidecar mode is selected.
- `server/plugins/boltz-status-poller.ts`
  - Polls pending Boltz invoices and persists state transitions.
- `server/api/lightning/boltz/health.get.ts`
  - Optional admin/debug endpoint for provider and daemon health.
- `scripts/boltz-client-install.mjs`
  - Downloads or validates pinned Linux binaries.
  - Verifies manifest signature/hash.
  - Writes suggested systemd unit template.

### 8.2 Data Flow

Invoice creation:

1. App calls `POST /api/lightning/purchase` or donation route.
2. Existing route resolves `lightning_default_provider=boltz`.
3. `useLightning().createPayment` calls `createLightningInvoice`.
4. `createBoltzProvider.createInvoice` calls `boltzd` gRPC `CreateReverseSwap`.
5. Provider returns BOLT11 invoice and swap id.
6. Existing `saveInvoiceToDatabase` stores invoice document.
7. Existing order-created fulfillment runs.

Payment settlement:

1. Buyer pays BOLT11.
2. Boltz swap moves toward successful state and settles to Liquid wallet.
3. Poller queries pending Boltz invoice documents.
4. Poller calls provider `getInvoiceStatus(swapId)`.
5. If status changed, poller updates invoice doc through `applyInvoicePaymentStatus`.
6. If paid, existing fulfillment updates order/user/link docs and publishes SSE events.

## 9. Error Handling

Provider errors:

- gRPC unavailable: invoice creation fails with 503-style error.
- amount below/above Boltz limits: invoice creation fails with clear 400-style error.
- wallet missing/readonly unsupported for receive flow: startup health failure and invoice creation failure.
- swap creation succeeds but persistence fails: preserve current best-effort behavior, but log enough metadata to manually reconcile.

Status errors:

- temporary gRPC failure: poller records warning and retries later.
- swap not found: keep pending for a short grace window, then mark failed only if repeated.
- terminal error from Boltz: mark invoice `failed`, not `cancelled`, unless Boltz explicitly indicates user cancellation/refund.

Operational errors:

- managed binary missing: provider is not ready; startup should log actionable instructions.
- signature/hash verification failure: refuse to install/start bundled binary.
- multiple daemons pointing at same data dir: deployment must prevent this through systemd single unit and file locking.

## 10. Security Requirements

- Do not log macaroons, cert contents, wallet mnemonics, or full config values.
- Verify downloaded Boltz Client releases via manifest signature and SHA256 before using binaries.
- Pin Boltz Client version; do not default production to unpinned `latest`.
- Run `boltzd` as a non-root app user.
- Keep `boltzd` gRPC bound to localhost by default.
- Use TLS/cert validation for gRPC unless explicitly `boltz_allow_insecure=true` in non-production.
- Keep Liquid wallet seed/material inside the app-owned Boltz data dir with restrictive permissions.
- Avoid direct swap cryptography in Nuxt v1; delegate claim/refund lifecycle to Boltz Client.

## 11. Observability

Logs:

- provider initialization with masked config status;
- swap creation success/failure;
- status poll transition summaries;
- gRPC connectivity failures;
- managed binary version and verification result.

Metrics/counters:

- created Boltz invoices;
- pending Boltz invoices;
- paid/expired/failed transitions;
- poller failures;
- daemon health status.

Admin/debug:

- health endpoint should report:
  - provider configured;
  - gRPC reachable;
  - `boltzd` version;
  - wallet id configured;
  - last successful status poll timestamp.

## 12. Testing Requirements

Unit tests:

- config resolver reads Boltz keys from CouchDB config.
- config validation requires Boltz keys only when provider is `boltz`.
- provider maps reverse swap creation into `InvoiceResponse`.
- provider maps Boltz states into layer statuses.
- provider rejects non-sats currency.
- service factory registers `boltz`.

Integration-style tests with mocks:

- purchase route works with `lightning_default_provider=boltz`.
- saved invoice doc contains `provider: boltz` and swap metadata.
- poller updates a pending invoice to paid.
- paid transition triggers existing fulfillment/event paths.
- transient gRPC errors do not mark invoices failed.

Deployment tests:

- binary installer selects correct Linux architecture.
- manifest/hash verification failure aborts.
- generated systemd unit uses the configured app user, data dir, and binary path.

Manual QA:

- macOS Docker/regtest flow can create and settle a test swap.
- Debian staging can create a purchase invoice, pay it, and observe:
  - invoice doc paid;
  - order fulfilled;
  - user/product entitlement updated;
  - SSE event received;
  - Liquid settlement transaction visible in Boltz wallet.

## 13. Rollout Plan

Phase 1: PRD and implementation plan.

Phase 2: Provider skeleton and config resolver.

Phase 3: gRPC adapter with mocked Boltz responses.

Phase 4: invoice creation and CouchDB persistence.

Phase 5: status poller and payment transitions.

Phase 6: managed Debian deployment scripts and docs.

Phase 7: staging validation with real Boltz Client.

Phase 8: optional streaming listener and admin diagnostics.

## 14. Open Decisions

- Whether deployment should download Boltz Client during deploy or commit checked-in binary artifacts to a private release bundle.
- Whether the app should generate/import the Liquid wallet automatically or require an operator-provided wallet id from a prior setup step.
- Whether `boltz_cert_pem` should live in CouchDB config or a filesystem secret path.
- Whether status updates should start with polling only or include gRPC streaming in v1.
- Whether production will ever run more than one app instance against the same orders database and Boltz data dir.

## 15. Recommended Decisions

- Do not commit binaries into the git repository.
- Pin a Boltz Client version and fetch verified release artifacts in deployment.
- Use an app-owned systemd sidecar for `boltzd` on Debian.
- Use Docker or mocks on macOS.
- Require an already initialized Boltz wallet id for v1.
- Store certificates/secrets on disk and keep only paths/references in CouchDB config where possible.
- Start with polling; add streaming after the provider is stable.

## 16. Source References

- Boltz Client docs: `https://client.docs.boltz.exchange/`
- Boltz Client releases: `https://github.com/BoltzExchange/boltz-client/releases`
- Boltz Client Go module: `https://pkg.go.dev/github.com/BoltzExchange/boltz-client/v2`
- Boltz BTCPay plugin: `https://github.com/BoltzExchange/boltz-btcpay-plugin`
- BTCPay core Lightning handler: `https://github.com/btcpayserver/btcpayserver/blob/master/BTCPayServer/Payments/Lightning/LightningLikePaymentHandler.cs`
