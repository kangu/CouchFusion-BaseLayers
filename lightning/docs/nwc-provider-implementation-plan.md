# NWC Lightning Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a receive-only `nwc` provider that uses the existing Lightning invoice, fulfilment, event, and SSE lifecycle.

**Architecture:** `providers/nwc-client.ts` is the sole wrapper around `@getalby/sdk`; `providers/nwc.ts` adapts it to `LightningProvider`. A single Nitro plugin subscribes and reconciles pending NWC invoices by calling one shared refresh helper that performs verified, idempotent state transitions.

**Tech Stack:** Nuxt 4/Nitro, TypeScript, Vitest, CouchDB, `@getalby/sdk` NWC client.

## Global Constraints

- Provider key is exactly `nwc`; existing `alby` behavior is unchanged.
- `nwc_connection_uri` is read directly from `cf_env_[slug]` only when `nwc` is selected.
- Never log, return, persist, or expose the connection URI or Nostr private key material.
- v1 is a single-Nitro-instance runtime.
- Amounts are positive integer sats in the layer and converted to integer msats only at the NWC adapter boundary.
- Notification events only trigger authoritative `lookup_invoice`; they never settle an invoice directly.
- Preserve `lightning_invoice`, `applyInvoicePaymentStatus`, fulfilment, payment event log, invoice links, and SSE.

---

### Task 1: Establish the provider/config/type surface

**Files:**
- Modify: `lightning/types/lightning.ts`
- Modify: `lightning/types/payment-events.ts`
- Modify: `lightning/server/utils/lightning-config.ts`
- Modify: `lightning/services/lightning.ts`
- Modify: `lightning/utils/lightning.ts`
- Modify: `lightning/server/composables/useLightning.ts`
- Modify: `lightning/server/api/lightning/donation.post.ts`
- Test: `lightning/tests/lightning-config.spec.ts`
- Test: `lightning/tests/lightning-service.spec.ts`

**Interfaces:**
- Produces `LightningProviderName = 'strike' | 'alby' | 'blink' | 'nwc'` and `LightningInvoiceStatus = 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed'`.
- Produces `NwcConfig { connectionUri: string; reconcileIntervalMs?: number }`.

- [ ] Add failing tests proving NWC config is read from `nwc_connection_uri`, required only when NWC is active, and config-source logging never includes the URI.
- [ ] Run `bunx vitest run --config lightning/vitest.config.ts lightning/tests/lightning-config.spec.ts`; expect the NWC assertions to fail because NWC is unsupported.
- [ ] Add shared provider/status aliases; apply them to public invoice/payment/config/event types and add NWC config resolution/validation without printing raw values.
- [ ] Add a failing service-factory test using a mocked `createNwcProvider`.
- [ ] Register the NWC factory in `createLightningService`; use aliases in utility, composable, and donation provider input.
- [ ] Rerun the two focused tests; expect pass.

### Task 2: Add the isolated NWC transport adapter and provider

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `lightning/providers/nwc-client.ts`
- Create: `lightning/providers/nwc.ts`
- Test: `lightning/tests/nwc-provider.spec.ts`

**Interfaces:**
- `NwcClientAdapter.createInvoice(input: { amountMsats: number; description?: string }): Promise<NwcInvoiceRecord>`
- `NwcClientAdapter.lookupInvoice(paymentHash: string): Promise<NwcInvoiceRecord>`
- `NwcClientAdapter.subscribeToPayments(handler): Promise<() => void>`
- `NwcInvoiceRecord` exposes only payment hash, BOLT11 invoice, amount msats, timestamps, and normalized raw state.

- [ ] Add failing provider tests for sats-to-msats conversion, non-sats/integer rejection, pending invoice mapping, paid status lookup, and SDK-independent subscription forwarding.
- [ ] Run `bunx vitest run --config lightning/vitest.config.ts lightning/tests/nwc-provider.spec.ts`; expect module/factory failures.
- [ ] Add the official `@getalby/sdk` dependency and lockfile update.
- [ ] Implement the narrow adapter with dynamic SDK construction, `make_invoice`, `lookup_invoice`, close handling, and a mockable factory; do not leak SDK types.
- [ ] Implement `createNwcProvider` with status mapping and no webhook validation/processing side effects.
- [ ] Rerun NWC provider tests; expect pass.

### Task 3: Add verified refresh and NWC background runtime

**Files:**
- Create: `lightning/server/utils/nwc-payment-refresh.ts`
- Create: `lightning/server/plugins/nwc-payment-reconciliation.ts`
- Modify: `lightning/utils/design-documents.ts`
- Modify: `lightning/server/utils/pending-invoice-expiration.ts`
- Test: `lightning/tests/nwc-payment-refresh.spec.ts`
- Test: `lightning/tests/pending-invoice-expiration.spec.ts`
- Test: `lightning/tests/design-documents.spec.ts`

**Interfaces:**
- `refreshNwcInvoice(options)` loads one document, fetches NWC status, verifies invoice ID and expected amount, writes a state transition once, and returns `{ changed, invoiceDoc }`.
- The plugin queries `lightning/by_provider_and_status` with `['nwc', 'pending']`, bounds concurrent refreshes, and reuses the helper on notification/reconnect/interval.

- [ ] Add failing tests for nested provider/status map-view resolution, NWC expiry exclusion, verified paid transition, duplicate no-op, and amount-mismatch rejection.
- [ ] Run the focused test group; expect failures because the refresh helper/views do not yet support NWC.
- [ ] Fix `by_provider` and `by_provider_and_status` to resolve top-level, normalized, and legacy fields; ensure generic expiry skips NWC.
- [ ] Implement the refresh helper using `applyInvoicePaymentStatus`, payment event log, paid fulfilment, invoice-link updates, and event/SSE publication; conflicts reload and retry a bounded number of times.
- [ ] Implement the single-instance plugin with startup/reconnect/interval reconciliation and no secrets in diagnostics.
- [ ] Rerun focused tests; expect pass.

### Task 4: Wire purchase lifecycle and operational documentation

**Files:**
- Modify: `lightning/server/api/lightning/purchase.post.ts`
- Modify: `lightning/server/api/lightning/invoice/[invoiceId].get.ts` if NWC provider identification needs normalization
- Modify: `lightning/agents.md`
- Modify: `lightning/docs/nwc-provider-design.md`
- Create: `lightning/docs/implementation_results/<timestamp>_nwc-provider.md`
- Test: `lightning/tests/purchase-route.spec.ts`

- [ ] Add a failing purchase-route test showing `lightning_default_provider=nwc` persists the existing invoice document with provider `nwc` and returns the same public payment response.
- [ ] Run the focused purchase test; expect the NWC path to fail before factory/config support is complete.
- [ ] Make only the compatibility adjustments needed for the existing route to persist NWC invoice data and launch created fulfilment; do not add a new generic API.
- [ ] Add setup instructions covering CouchDB config, receive-only permission scope, required key, expected lifecycle, and single-instance restriction.
- [ ] Run the complete Lightning suite: `bunx vitest run --config lightning/vitest.config.ts`.

### Task 5: Full verification

**Files:**
- No production changes unless verification reveals a defect.

- [ ] Run `git diff --check`.
- [ ] Run `bunx vitest run --config lightning/vitest.config.ts`.
- [ ] Run a consuming-app typecheck if its local dependency environment is available; otherwise report that it was not run.
- [ ] Compare the final diff with `lightning/docs/nwc-provider-design.md`; confirm each acceptance criterion has test evidence.
