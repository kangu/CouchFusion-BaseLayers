# NWC Provider Design

## Decision

Add Nostr Wallet Connect as a new `nwc` provider in `layers/lightning`. Preserve the existing `alby` provider and its PAT-based behavior. Applications opt in through `cf_env_[slug]/lightning_default_provider=nwc`.

## Goal

Allow existing Lightning purchase and donation flows to create and verify receive-only NWC invoices without changing their public API or introducing a parallel payment system.

## Plugin Fit

NWC adapts to the layer's existing contracts:

- `LightningProvider` remains the application-facing invoice contract.
- Existing `lightning_invoice` documents remain canonical payment records.
- `applyInvoicePaymentStatus`, invoice event logging, fulfilment, invoice links, and payment SSE remain the only payment-lifecycle mechanisms.
- Existing `/api/lightning/purchase`, `/api/lightning/donation`, invoice-status, and SSE routes remain the app-facing API.

The module will not add the PRD's duplicate `lightning-payment` documents, generic `/api/couchfusion/payments` routes, browser-side NWC client, UI components, multi-connection support, outgoing payments, or merchant dashboard in v1.

## Configuration

The selected provider reads directly from the app CouchDB `_config` section:

```ini
[cf_env_<app-slug>]
lightning_default_provider=nwc
nwc_connection_uri=nostr+walletconnect://...
nwc_reconcile_interval_ms=60000
```

`nwc_connection_uri` is required only when `lightning_default_provider=nwc`. It is a raw secret by explicit product decision. It must never be included in configuration notices, thrown error text, API responses, logs, invoice metadata, or client bundles. CouchDB `_config` access controls are therefore a deployment prerequisite.

NWC connection permissions must be receive-only: invoice creation, invoice lookup, and received-payment notifications. The documented setup must exclude outgoing payment and administrative capabilities.

## Provider Adapter

Create an NWC-specific adapter behind `providers/nwc.ts`. It owns the NWC client, connection lifecycle, invoice creation, invoice lookup, settlement-state mapping, subscription, reconnection, and shutdown.

The provider returns the existing `InvoiceResponse` shape:

```ts
{
  invoiceId: paymentHash,
  paymentRequest: bolt11,
  amount: sats,
  currency: 'sats',
  status: 'pending',
  provider: 'nwc',
  expiresAt,
  paymentContext: { connection: 'nwc' }
}
```

The adapter accepts only positive integer satoshi invoices. Before returning `paid`, lookup must confirm the matching payment hash, a settled provider state, and the expected amount. Unknown, mismatched, or malformed notifications never change an invoice state.

## Persistence and Lifecycle

Invoice creation continues through `useLightning()` and the current purchase/donation handlers. The invoice document stores `invoiceData.provider='nwc'`; no separate NWC payment schema is created.

An NWC notification is only a prompt to refresh the matching invoice. The notification path:

1. extracts the payment hash;
2. loads the matching invoice with the existing design view;
3. fetches authoritative invoice state from the NWC adapter;
4. applies the normalized transition with `applyInvoicePaymentStatus`;
5. runs paid fulfilment, invoice-link updates, event log writes, and SSE publication once.

The reconciliation loop uses the same refresh routine for pending NWC invoices. It runs on startup, on reconnect, and at the configured interval. It must bound concurrency, continue after individual errors, and persist diagnostic attempt data without secrets.

`paid` is terminal. A provider response after nominal expiry that verifies settlement still transitions to `paid`. Pending/expired/failed/cancelled transitions must be idempotent and revision-conflict safe.

## Runtime Model

V1 supports one Nitro instance. A single process owns the NWC notification subscription and NWC reconciliation timer. Multiple instances require external coordination and are out of scope.

The provider creates no browser client and exposes no raw NWC messages. The existing authenticated SSE endpoint remains the real-time client mechanism.

## Observability and Operations

Logs record provider connection state, invoice lifecycle transitions, lookup/reconciliation outcomes, conflict retries, and unknown notifications. Values that could contain the NWC URI or Nostr keys are redacted.

An optional admin-gated health endpoint may report NWC configured, connected, and last reconciliation time; it must not expose the URI, relay list, or keys.

## Acceptance Criteria

- Existing providers and API shapes remain unchanged.
- NWC config validation is active-provider-only.
- An NWC invoice is persisted as the existing `lightning_invoice` shape.
- A valid NWC notification produces a verified, one-time paid transition and existing fulfilment/SSE effects.
- Duplicate, forged, unknown, and amount-mismatched notifications do not fulfil an order.
- Reconciliation recovers a paid NWC invoice after a missed notification or restart.
- The layer test command discovers and executes all layer tests.
