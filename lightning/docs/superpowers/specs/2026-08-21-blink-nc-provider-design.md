# Blink Non-Custodial Provider Design

## Decision

Add a receive-only provider named exactly `blink_nc` to the Lightning layer. It will create invoices through the public LNURL-pay endpoint of a Blink Lightning address and verify settlement through the per-invoice LUD-21 endpoint. It remains separate from the API-key-backed custodial `blink` provider.

The first consuming application and live validation target is Bitvocation at `/Users/radu/Projects/nuxt-apps/apps/bitvocation`.

## Goal

Allow CouchFusion applications to receive merchant payments into a Blink non-custodial Spark account without holding an API key, wallet ID, seed, or spend capability, while preserving the existing CouchDB invoice, order-fulfilment, payment-event, invoice-link, and SSE lifecycle.

## Source Material and Confirmed Capabilities

This design implements the findings in `docs/blink_nc_research.md`, checked against:

- Blink's [BTCPay Server plugin documentation](https://dev.blink.sv/examples/btcpayserver-plugin), which confirms that non-custodial Spark receiving uses a Blink Lightning address, is receive-only and mainnet-only, has no API key or wallet ID, and detects settlement by polling.
- The [Blink BTCPay plugin source](https://github.com/Kukks/BTCPayServerPlugins/blob/master/Plugins/BTCPayServer.Plugins.Blink/BlinkLnAddressLightningClient.cs), which shows the LNURL metadata/callback flow, exact-amount checks, callback-origin verification URL recovery, BOLT11 validation, polling/backoff, and preimage validation.
- [LUD-21](https://github.com/lnurl/luds/blob/luds/21.md), which defines the optional callback `verify` URL and its `settled`, `preimage`, and `pr` response fields.
- [BOLT 11](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md), which defines the payment hash, description hash, amount, timestamp, and expiry fields that must be checked locally.

The local research slightly overstates BTCPay's proof policy. Current BTCPay code still reports `paid` from `settled: true` when the preimage is invalid, while discarding the invalid preimage. CouchFusion deliberately uses a stricter rule: an invoice cannot become paid without a valid preimage whose SHA-256 digest equals the persisted payment hash.

## Scope

Version 1 includes:

- exact provider key `blink_nc`;
- mainnet BTC/sats receiving to one configured `username@blink.sv` address per app;
- LNURL-pay metadata and invoice creation;
- LUD-21 polling with strict cryptographic proof validation;
- canonical `lightning_invoice` persistence;
- background reconciliation, expiry ownership, recovery after restart, and capped retry backoff;
- existing order fulfilment, email, invoice-link, payment-event-log, and SSE side effects;
- Bitvocation purchase, donation, membership, and Career Hub guest-checkout compatibility;
- unit, integration, recovery, and live mainnet smoke-test procedures.

Version 1 excludes:

- outgoing payments, refunds, balance queries, channels, Spark SDK access, or wallet-seed access;
- non-Blink Lightning addresses;
- testnet, signet, regtest, or HTTP endpoints;
- non-custodial USDB receiving;
- multiple Blink addresses in one app configuration;
- a new payment document type or new public payment API;
- browser-side LNURL or LUD-21 calls;
- multi-instance distributed locking;
- migration or automatic fallback between custodial `blink` and `blink_nc`.

## Provider Identity and Configuration

Extend both `LightningProviderName` and `PaymentProvider` with `blink_nc`. Existing provider names and behavior stay unchanged.

Configuration is read from the app-scoped CouchDB section required by the repository standard:

```ini
[cf_env_bitvocation]
lightning_default_provider=blink_nc
blink_nc_lightning_address=merchant@blink.sv
blink_nc_reconcile_interval_ms=3000
blink_nc_settlement_grace_ms=120000
blink_nc_max_concurrency=5
```

Only `blink_nc_lightning_address` is required. Defaults are:

- `blink_nc_reconcile_interval_ms=3000`;
- `blink_nc_settlement_grace_ms=120000`;
- `blink_nc_max_concurrency=5`.

Numeric values must be positive safe integers within explicit operational bounds:

- reconciliation interval: 1,000 through 60,000 milliseconds;
- settlement grace: 0 through 600,000 milliseconds;
- concurrency: 1 through 20.

The address must normalize to a lowercase local part and exact lowercase domain `blink.sv`. A bare username is not accepted in CouchDB configuration because explicit addresses are easier to audit. The resolver must reject whitespace, URL syntax, credentials, ports, paths, query strings, non-ASCII control characters, and any domain other than `blink.sv`.

Configuration notices may log the CouchDB key name, normalized provider name, and whether a value is present. They must not log the configured address. Although the address is not a spending secret, treating it as private operational data avoids unnecessary disclosure and keeps provider logging consistent.

The provider is included in resolved configuration whenever its address is present, not only while it is the default. This allows a pending `blink_nc` invoice to finish reconciliation after the application switches its default provider.

## Component Boundaries

### `providers/blink-nc-client.ts`

This is the only LNURL/LUD-21 transport module. It owns:

- Lightning-address parsing and normalization;
- safe, bounded JSON GET requests;
- LNURL metadata validation;
- callback URL construction;
- BOLT11 decoding and validation;
- verification URL validation and recovery;
- strict LUD-21 proof verification;
- protocol-specific error classification.

It must accept an injectable `fetch` and clock so protocol behavior can be tested without network access.

Use `light-bolt11-decoder` as an explicit direct dependency for checksum-checked BOLT11 parsing. Use Node's `crypto` for SHA-256 and constant-time digest comparison. The adapter must wrap decoder output in narrow local types so decoder-specific shapes do not leak into the shared provider API.

### `providers/blink-nc.ts`

This adapts the transport client to `LightningProvider`. It validates the shared request shape, maps transport results into `InvoiceResponse`, and declares webhook methods as unsupported:

```ts
validateWebhook: () => false
processWebhook: async () => null
```

It does not poll, access CouchDB, fulfil orders, or publish events.

### Shared provider lookup contract

The current provider contract passes only `invoiceId` to `getInvoiceStatus`. Add an optional second argument:

```ts
interface InvoiceLookupContext {
  paymentRequest?: string
  amount?: number
  currency?: string
  expiresAt?: Date | string
  paymentContext?: Record<string, unknown>
}

getInvoiceStatus(
  invoiceId: string,
  context?: InvoiceLookupContext,
): Promise<InvoiceResponse>
```

Existing providers ignore the optional context. `blink_nc` requires persisted context for authoritative reconciliation and uses metadata-based URL reconstruction only as a recovery path for legacy documents.

Propagate the optional context through `createLightningService`, `checkLightningInvoiceStatus`, and `useLightning.checkPaymentStatus`. No existing call site is required to provide it.

### `server/utils/blink-nc-payment-refresh.ts`

This is the single authoritative state-transition routine for one persisted invoice. It:

1. validates the persisted provider, invoice ID, amount, currency, BOLT11, expiry, and verification context;
2. calls the provider with the persisted lookup context;
3. verifies identity, amount, and strict proof results;
4. performs an idempotent status transition;
5. applies paid fulfilment and linked-invoice updates;
6. records a payment event log;
7. publishes scoped SSE events;
8. handles bounded CouchDB revision-conflict retries.

All triggers, including interval reconciliation and any future manual refresh endpoint, must call this routine rather than duplicate lifecycle logic.

### `server/plugins/blink-nc-payment-reconciliation.ts`

This owns the single-process background timer, pending-invoice query, adaptive scheduling, per-invoice transport-error backoff, concurrency limit, startup recovery, and clean hot-reload state.

It starts whenever `config.providers.blink_nc` is present, even if another provider is currently the default. This preserves historical invoice completion.

## Invoice Creation Flow

For an `N` sat request:

1. Require `currency.toLowerCase() === 'sats'`.
2. Require `N` to be a positive safe integer and require `N * 1000` to remain a safe integer.
3. Fetch `https://blink.sv/.well-known/lnurlp/<encoded-username>`.
4. Require HTTP 2xx, JSON within the response limit, `tag === 'payRequest'`, a string `metadata`, a valid callback, and safe integer `minSendable`/`maxSendable` values.
5. Require `N * 1000` inside the advertised inclusive bounds.
6. Add `amount=<msats>` without discarding existing callback query parameters.
7. If `commentAllowed > 0`, add a Unicode-code-point-safe truncation of the merchant description. The comment is presentation metadata and is not trusted as the invoice commitment.
8. Fetch the callback and require HTTP 2xx, non-error JSON, and a non-empty `pr`.
9. Decode the BOLT11 locally and require:
   - Bitcoin mainnet network prefix;
   - checksum-valid invoice;
   - exact requested millisatoshi amount;
   - a 32-byte payment hash;
   - timestamp and finite positive expiry;
   - an expiry time later than the current clock;
   - a description hash equal to `SHA256(metadata)` as required by LNURL-pay.
10. Resolve the verification URL from the callback response's `verify` field. If absent, construct `/verify/<paymentHash>` on the callback origin.
11. Require the verification URL to be HTTPS, contain no credentials, and use `blink.sv` or a subdomain of `blink.sv`. Persist the exact accepted URL.

The returned provider response is:

```ts
{
  invoiceId: paymentHash,
  id: paymentHash,
  paymentRequest: bolt11,
  amount: amountSats,
  currency: 'sats',
  status: 'pending',
  provider: 'blink_nc',
  expiresAt,
  paymentContext: {
    protocol: 'lnurl-lud21',
    lightningAddress,
    verifyUrl,
    metadataHash,
  },
}
```

`paymentContext` is required for server persistence but is not a public response contract.

## HTTP and URL Safety

All three remote calls—metadata, callback, and verification—use one bounded fetch helper with:

- HTTPS only;
- no automatic redirects (`redirect: 'manual'`);
- 8-second timeout via `AbortController`;
- maximum 256 KiB response body;
- JSON content handling with clear protocol errors;
- no request cookies, authorization headers, or forwarded client headers;
- Blink-owned hostname validation before every request;
- sanitized errors that do not reproduce arbitrary response bodies or full verification URLs.

The fixed `blink.sv` scope substantially reduces generic LNURL SSRF exposure. Callback and verification URLs are still treated as untrusted data and independently validated. Localhost, IP literals, ports, alternate schemes, user-info, and look-alike suffixes such as `blink.sv.attacker.example` are rejected.

## Persistence and Public Data Boundary

The existing `lightning_invoice` document remains canonical. Do not introduce a second payment document.

Persist the complete provider result under `invoiceData`, including server verification context. Normalize these fields under `payment` as needed for future migration:

```ts
payment: {
  status: 'pending',
  provider: 'blink_nc',
  providerInvoiceId: paymentHash,
  paymentRequest: bolt11,
  amount: amountSats,
  currency: 'sats',
  expiresAt,
  providerContext: {
    protocol: 'lnurl-lud21',
    lightningAddress,
    verifyUrl,
    metadataHash,
  },
  createdAt,
}
```

Update `createInvoicePaymentState` to copy provider, amount, currency, expiry, and provider context into normalized `payment` fields while preserving legacy `invoiceData` compatibility.

The following fields are server-only and must never appear in purchase, donation, guest-checkout, invoice-status, or SSE responses:

- `verifyUrl`;
- returned preimage;
- raw LNURL metadata or callback response;
- internal retry/backoff diagnostics.

Add a shared public-payment serializer that explicitly selects invoice ID, payment request, amount, currency, status, expiry, and provider. Purchase and donation handlers must return this serializer's output rather than the persisted object. Career Hub already returns an allowlisted subset and should use the same serializer for consistency.

The preimage may be persisted only after successful verification, under `payment.proof.preimage`, for auditability. It must not be copied into `invoiceData`, events, logs, or API responses.

## Strict Settlement Invariant

`blink_nc` may transition to `paid` only if every condition succeeds:

1. The persisted document is a `lightning_invoice` whose provider is exactly `blink_nc`.
2. Its provider invoice ID is 64-character hexadecimal and equals the payment hash decoded from the persisted BOLT11.
3. The provider returns the same invoice ID and provider.
4. The persisted BOLT11 amount and provider response amount equal the persisted expected integer sat amount.
5. LUD-21 returns `settled === true`.
6. LUD-21 returns a 64-character hexadecimal preimage.
7. `SHA256(hexToBytes(preimage))` equals the persisted payment hash using a constant-time byte comparison.

The `pr` returned by the verification endpoint is not authoritative. Blink's BTCPay integration notes that this field has been observed with a payment hash different from the verification key. CouchFusion always uses the BOLT11 stored at creation. A returned `pr` may be compared for diagnostics but cannot replace persisted invoice data.

If `settled` is false, the invoice remains pending until its expiry policy applies. If `settled` is true but the proof is absent, malformed, or mismatched, the result is `proof_invalid`: no status mutation, fulfilment, linked update, or paid event occurs. The reconciler logs a sanitized warning and retries with backoff.

An explicit LUD-21 `{ status: 'ERROR', reason: 'Not found' }` is not treated as paid or failed immediately. For a persisted invoice it is retryable until expiry plus grace, because availability and indexing delays must not destroy the local payment record.

## Reconciliation and Expiry

Query the existing `lightning/by_provider_and_status` view with `['blink_nc', 'pending']` and `include_docs: true`. The design document already resolves provider and status across top-level, normalized, and legacy fields.

The plugin keeps per-invoice scheduling state in process memory:

- invoice age 0–2 minutes: successful unsettled checks every 3 seconds;
- age over 2 minutes and before nominal expiry: every 10 seconds;
- nominal expiry through the configured settlement grace: every 30 seconds;
- transport or proof errors: exponential backoff from the current interval, capped at 30 seconds;
- paid, cancelled, failed, or expired: remove from scheduling.

Each timer tick loads pending documents, skips entries whose next-attempt time has not arrived, and processes at most the configured concurrency. One invoice failure cannot abort the batch. The timer must not overlap itself.

At nominal BOLT11 expiry, continue verification through `expiresAt + settlementGraceMs`. This covers a payment accepted shortly before expiry but not yet reflected by Blink's LNURL server. After the grace deadline:

1. perform one final verification attempt;
2. if strict proof succeeds, transition to paid;
3. otherwise transition to expired and publish `invoice.expired`.

The generic hourly pending-invoice expiration utility must skip `blink_nc`, as it already skips NWC. The `blink_nc` reconciler owns protocol-aware expiry.

On process restart, the first reconciliation runs immediately and reconstructs scheduling from persisted documents. If `verifyUrl` is missing on a legacy document, the provider may refetch current metadata and derive `<callback-origin>/verify/<paymentHash>`, but the derived URL must pass the same host checks. The recovery path must never overwrite the persisted BOLT11 or payment hash.

Version 1 assumes one Nitro instance. Multi-instance deployments require a distributed lease or external worker and are explicitly unsupported until that coordination exists.

## Idempotent State Transition and Side Effects

Use the existing lifecycle components rather than provider-specific duplicates:

- `applyInvoicePaymentStatus` for normalized and legacy status fields;
- `beginPaymentEventProcessing`, `markPaymentEventProcessed`, and `markPaymentEventFailed` for one processing record per provider invoice/status transition;
- `updateLinkedInvoiceDocuments` for invoice-link consumers;
- `applyInvoicePaidFulfillment` for order, membership, guest-account, and email behavior;
- `paymentEventBus.publish` for `invoice.paid`, `invoice.expired`, and `order.fulfilled` events.

Use deterministic provider event IDs:

```text
blink_nc:<paymentHash>:paid
blink_nc:<paymentHash>:expired
```

Before side effects, reload the invoice and re-check its current status. `paid` is terminal. Duplicate reconciliation calls return `changed: false`. A paid invoice never regresses to pending or expired.

CouchDB revision conflicts are retried by reloading the current invoice a maximum of three times with small jitter. If another worker has already applied the same terminal status, treat the operation as a successful no-op. If conflicts remain, mark the payment event attempt failed and retry during the next reconciliation pass.

Fulfilment can involve several CouchDB documents and email-queue writes, so it is not a single transaction. Existing fulfilment markers and payment-event logs remain the idempotency boundary. A failure after the invoice becomes paid must leave a failed event log that can be retried without reverting payment status.

## Error Classification and Observability

Use structured provider-prefixed logs such as `[lightning][blink_nc]`. Allowed fields include payment hash, invoice document ID, order ID, status, attempt count, latency, error class, and next retry time.

Error classes are:

- `configuration_invalid`;
- `metadata_invalid`;
- `amount_out_of_bounds`;
- `callback_invalid`;
- `invoice_invalid`;
- `transport_unavailable`;
- `verification_not_found`;
- `proof_invalid`;
- `persistence_conflict`;
- `fulfillment_failed`.

Never log the full Lightning address, callback URL query, verification URL, BOLT11, preimage, raw response body, or CouchDB configuration value. Logs may include the payment hash because it is already the canonical invoice identifier used throughout the layer.

Startup logs report whether the provider is configured, whether metadata validation succeeded, the effective reconciliation timings, and that strict proof mode is active. Startup metadata failure should not stop Nitro or database initialization; invoice creation will fail closed until Blink recovers or configuration is corrected.

## Bitvocation Integration

Bitvocation already extends the Lightning layer and uses provider-neutral responses in:

- `SubscriptionWidget.vue`;
- `LiteSubscriptionWidget.vue`;
- `CareerHubGuestCheckoutModal.vue`;
- `/api/lightning/purchase`;
- `/api/lightning/career-hub-checkout`;
- `/api/lightning/invoice/:invoiceId`;
- `/api/lightning/events`.

No provider-specific UI or new route is required. The background reconciler updates CouchDB and emits the existing SSE events. The widgets' existing CouchDB polling fallback then observes the same paid state if SSE is unavailable.

Bitvocation rollout sequence:

1. Deploy code with `blink_nc` configured but keep the current default provider.
2. Run startup metadata validation against the real Spark Lightning address.
3. Create an invoice through a non-production/manual test entry point or a low-price test product and inspect the persisted server-only context.
4. Pay a minimal mainnet invoice from a separate Lightning wallet.
5. Confirm strict preimage validation, invoice paid transition, linked order activation, membership/guest fulfilment, email queue writes, and SSE/UI confirmation.
6. Restart Nitro with a second unpaid test invoice, pay it while the process is down, and confirm startup reconciliation recovers it.
7. Test duplicate reconciliation, invalid/missing preimage fixtures, Blink timeout, expiry plus grace, cancellation, and provider switch with a historical pending invoice.
8. Set `lightning_default_provider=blink_nc` only after the above evidence passes.

Because `blink_nc` is mainnet-only, automated tests mock remote HTTP. The live smoke test spends real sats and therefore requires explicit operator execution with a capped low-value product; it is never part of CI.

## Testing Strategy

### Protocol unit tests

Cover:

- address normalization and rejection cases;
- HTTPS and Blink-host allowlisting;
- redirect, timeout, oversized body, non-JSON, non-2xx, and LNURL error responses;
- min/max amount boundaries and safe sats-to-msats conversion;
- existing callback query preservation and comment truncation;
- mainnet, exact amount, metadata description-hash, payment-hash, and expiry checks;
- returned verification URL and callback-origin fallback;
- unsettled, valid paid proof, missing proof, malformed hex, mismatched proof, and verify `pr` mismatch;
- sanitized errors and logs.

### Provider and configuration tests

Cover:

- `blink_nc` name/type/service registration;
- active-provider-only required configuration;
- inclusion for reconciliation when configured but not default;
- numeric defaults and bounds;
- no configuration values in source logs;
- persisted lookup context propagation;
- no webhook behavior.

### Refresh and reconciliation tests

Cover:

- verified paid transition;
- amount, ID, provider, and BOLT11 mismatch rejection;
- strict invalid-proof no-op;
- duplicate paid no-op;
- CouchDB conflict retry and terminal-status race;
- event-log success/failure;
- fulfilment, linked invoice, and SSE calls exactly once;
- adaptive intervals, capped backoff, concurrency, non-overlap, and per-invoice error isolation;
- startup recovery and missing-context URL reconstruction;
- nominal expiry grace and final verification;
- generic expiry exclusion.

### Route and public-boundary tests

Cover purchase, donation, authenticated membership, and guest Career Hub creation. Assert the existing public invoice fields remain available while `verifyUrl`, preimage, raw context, and retry data never appear in responses or SSE.

### Bitvocation tests

Use the existing Bitvocation Vitest configuration for payment notification, subscription widget, restoration, cancellation, and guest-checkout behavior. Add provider-neutral fixtures using `provider: 'blink_nc'`. No snapshot or assertion should depend on a provider-specific UI label.

### Verification commands

The implementation plan will use focused tests first and then:

```bash
# from /Users/radu/Projects/nuxt-apps/layers
bunx vitest run --config lightning/vitest.config.ts

# from /Users/radu/Projects/nuxt-apps
layers/node_modules/.bin/vitest \
  --config layers/bitvocation-content.vitest.config.ts \
  apps/bitvocation/tests/lightning \
  --run

# consuming-app typecheck, but no final lint/build per Bitvocation instructions
cd apps/bitvocation && nuxt typecheck
```

## Known Baseline Failures

The investigation established these unrelated failures before implementation:

- Lightning layer: 8 failures in Strike/Blink webhook route suites because the layer Vitest config cannot resolve `#auth/server/utils/login-token`; 61 of 69 tests pass.
- Bitvocation focused Lightning tests: 3 cancellation response assertions omit the handler's existing `orderCancelled: false` field; 7 of 10 tests pass.

The implementation must either repair the test harness/assertions in separately identified setup commits or preserve the failures as documented baseline evidence. `blink_nc` cannot be declared fully verified while new failures are hidden among these existing ones.

## Acceptance Criteria

- Existing `strike`, `alby`, `blink`, and `nwc` behavior and public invoice fields remain compatible.
- `blink_nc` configuration comes only from the app's CouchDB `_config` section and is required only when selected for creation.
- A valid request produces a mainnet, exact-amount BOLT11 invoice whose payment hash, expiry, and LNURL metadata commitment are locally verified.
- The exact accepted LUD-21 verification URL is persisted server-side and never returned to clients.
- `settled: true` without a matching cryptographic preimage never changes payment or order state.
- A valid proof produces one canonical paid transition and the existing fulfilment, linked-invoice, email, event-log, and SSE effects.
- Duplicate, mismatched, malformed, and conflict-racing checks cannot double-fulfil an order.
- Startup and interval reconciliation recover payments missed during downtime.
- Protocol-aware expiry performs a final verification after the settlement grace period.
- Bitvocation's membership, Lite membership, donation, and Career Hub guest flows work without provider-specific frontend code.
- Automated tests require no live Blink account; the documented live smoke test validates a real low-value mainnet payment before production cutover.

