# Blink Non-Custodial Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a strict-proof, receive-only `blink_nc` provider to the Lightning layer and validate it through Bitvocation's existing payment flows.

**Architecture:** A narrow Blink LNURL/LUD-21 client validates and creates exact-amount BOLT11 invoices, while a provider adapter exposes the existing `LightningProvider` contract with persisted lookup context. A single-instance Nitro reconciler uses one idempotent refresh routine to require a matching preimage before applying the existing CouchDB payment, fulfilment, invoice-link, event-log, and SSE lifecycle.

**Tech Stack:** Nuxt 4, Nitro, Vue 3.5, TypeScript strict mode, Vitest, CouchDB, LNURL-pay/LUD-21, BOLT11, Node `crypto`, `light-bolt11-decoder`.

**Spec:** `lightning/docs/superpowers/specs/2026-08-21-blink-nc-provider-design.md`

## Global Constraints

- Provider key is exactly `blink_nc`; custodial `blink` behavior remains unchanged.
- Only exact `username@blink.sv` mainnet addresses are accepted in v1.
- `blink_nc_lightning_address` and optional timing values come only from `cf_env_[app-slug]` in CouchDB `_config`.
- Receiving is the only supported wallet operation; no seed, API key, wallet ID, balance, outgoing payment, refund, or channel operation is added.
- `settled: true` is insufficient: `SHA256(preimage)` must equal the persisted payment hash before a paid transition.
- The persisted BOLT11 and payment hash are authoritative; the LUD-21 response `pr` never replaces them.
- `verifyUrl`, preimage, raw remote payloads, and retry diagnostics are server-only.
- Preserve the canonical `lightning_invoice` document and existing fulfilment, invoice-link, payment-event-log, and SSE mechanisms.
- All remote requests are HTTPS-only, redirect-disabled, Blink-host allowlisted, timeout-bounded, and response-size-bounded.
- V1 supports one Nitro instance; distributed reconciliation locking is out of scope.
- Automated tests mock Blink. A real mainnet smoke test is manual and requires separate operator authorization before spending sats.
- Do not edit `covenant-service/`.
- Do not run final lint or `bun run build` in Bitvocation. Run its focused Vitest tests and `nuxt typecheck` only.
- The Lightning layer and Bitvocation are separate Git repositories. Commit layer changes from `/Users/radu/Projects/nuxt-apps/layers` and app changes from `/Users/radu/Projects/nuxt-apps/apps/bitvocation`.

---

## File Structure

### New Lightning-layer files

- `lightning/providers/blink-nc-client.ts` — bounded Blink LNURL/LUD-21 transport, URL validation, BOLT11 validation, and proof verification.
- `lightning/providers/blink-nc.ts` — `LightningProvider` adapter and provider-specific connection probe.
- `lightning/server/utils/blink-nc-payment-refresh.ts` — verified idempotent state transition and downstream side effects for one invoice.
- `lightning/server/utils/blink-nc-reconciliation.ts` — pure scheduling/backoff/batch helpers used by the Nitro plugin.
- `lightning/server/plugins/blink-nc-payment-reconciliation.ts` — single-process startup and interval reconciliation runtime.
- `lightning/utils/public-payment.ts` — explicit public payment allowlist that excludes provider context and proof material.
- `lightning/tests/blink-nc-client.spec.ts` — protocol, HTTP safety, BOLT11, and proof tests.
- `lightning/tests/blink-nc-provider.spec.ts` — shared contract mapping and lookup-context tests.
- `lightning/tests/blink-nc-payment-refresh.spec.ts` — strict transition, idempotency, conflicts, fulfilment, links, logs, and SSE tests.
- `lightning/tests/blink-nc-reconciliation.spec.ts` — adaptive scheduling, expiry grace, concurrency, and failure isolation tests.
- `lightning/tests/lightning-service.spec.ts` — provider factory and lookup-context routing tests.
- `lightning/tests/public-payment.spec.ts` — response allowlist tests.
- `lightning/tests/donation-route.spec.ts` — donation persistence and public-boundary integration tests.
- `lightning/tests/blink-nc-init.spec.ts` — startup notice, redaction, and no-webhook behavior tests.
- `lightning/tests/pending-invoice-expiration.spec.ts` — provider-owned expiry exclusion tests.
- `lightning/README_blink_nc.md` — CouchDB setup, receive-only limits, operation, and smoke-test runbook.
- `lightning/docs/implementation_results/` — execution-time provider implementation and verification record.

### Modified Lightning-layer files

- `package.json`, `bun.lock` at the layers repository root — direct BOLT11 decoder dependency.
- `lightning/types/lightning.ts`, `lightning/types/payment-events.ts` — provider/config/lookup types.
- `lightning/services/lightning.ts` — factory registration and lookup-context routing.
- `lightning/server/utils/lightning-config.ts` — CouchDB keys, validation, defaults, source notices.
- `lightning/utils/lightning.ts`, `lightning/server/composables/useLightning.ts` — optional persisted lookup context.
- `lightning/server/utils/payment-state.ts`, `lightning/utils/orders.ts` — normalized provider data persistence.
- `lightning/server/api/lightning/purchase.post.ts`, `donation.post.ts`, `career-hub-checkout.post.ts` — public response sanitization.
- `lightning/server/utils/pending-invoice-expiration.ts` — exclude protocol-owned `blink_nc` expiry.
- `lightning/server/plugins/init.ts` — provider startup notices only; no webhook setup.
- `lightning/tests/lightning-config.spec.ts`, `payment-state.spec.ts`, `purchase-route.spec.ts`, `career-hub-checkout-route.spec.ts` — integration coverage.
- `lightning/tests/blink-webhook-route.spec.ts`, `strike-webhook-route.spec.ts`, `lightning/vitest.config.ts` — clean baseline alias resolution.
- `lightning/agents.md` — provider API/config/runtime notes.

### Modified Bitvocation files

- `apps/bitvocation/tests/lightning/cancel-route.spec.ts` — reconcile the pre-existing response assertion.
- `apps/bitvocation/tests/lightning/use-payment-notifications.spec.ts` — provider-neutral `blink_nc` SSE fixture.
- `apps/bitvocation/tests/lightning/subscription-confirmation-height.spec.ts` — static checks that both subscription widgets remain provider-name neutral.
- `apps/bitvocation/README.md` — `blink_nc` configuration and receive-only behavior.
- `apps/bitvocation/docs/implementation_results/` — an execution-time validation record named with the normalized ISO timestamp and `_blink-nc-bitvocation-validation.md` suffix, as required by the app instructions.

---

### Task 1: Establish a Green, Attributed Baseline

**Files:**
- Modify: `lightning/vitest.config.ts`
- Modify: `apps/bitvocation/tests/lightning/cancel-route.spec.ts`
- Test: `lightning/tests/blink-webhook-route.spec.ts`
- Test: `lightning/tests/strike-webhook-route.spec.ts`
- Test: `apps/bitvocation/tests/lightning/cancel-route.spec.ts`

**Interfaces:**
- Consumes: existing webhook and Bitvocation cancellation behavior.
- Produces: a green 69-test Lightning baseline and green focused Bitvocation cancellation suite before `blink_nc` code exists.

- [ ] **Step 1: Add test-only aliases for the layer dependencies already imported by fulfilment**

Update `lightning/vitest.config.ts` to resolve `#auth`, `#database`, `#email`, and `#lightning` from the layers repository:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const layer = (name: string) => fileURLToPath(new URL(`../${name}`, import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["./lightning/tests/**/*.spec.ts", "./lightning/tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "#auth": layer("auth"),
      "#database": layer("database"),
      "#email": layer("email"),
      "#lightning": layer("lightning"),
    },
  },
});
```

- [ ] **Step 2: Run the two previously blocked webhook suites**

Run from `/Users/radu/Projects/nuxt-apps/layers`:

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/blink-webhook-route.spec.ts \
  lightning/tests/strike-webhook-route.spec.ts
```

Expected: 8 tests pass; no `#auth/server/utils/login-token` resolution error.

- [ ] **Step 3: Correct the three stale Bitvocation cancellation assertions**

Add the existing response field to all three exact response assertions:

```ts
expect(response).toEqual({
  success: true,
  cleared: true,
  invoiceCancelled: true,
  orderCancelled: false,
});
```

- [ ] **Step 4: Run the Bitvocation cancellation suite**

Run from `/Users/radu/Projects/nuxt-apps`:

```bash
layers/node_modules/.bin/vitest \
  --config layers/bitvocation-content.vitest.config.ts \
  apps/bitvocation/tests/lightning/cancel-route.spec.ts \
  --run
```

Expected: 3 tests pass.

- [ ] **Step 5: Run and record the complete Lightning baseline**

```bash
cd /Users/radu/Projects/nuxt-apps/layers
bunx vitest run --config lightning/vitest.config.ts
```

Expected: 17 files and 69 tests pass before feature tests are added.

- [ ] **Step 6: Commit the two repositories separately**

```bash
cd /Users/radu/Projects/nuxt-apps/layers
git add lightning/vitest.config.ts
git commit -m "test(lightning): restore fulfilment dependency aliases"

cd /Users/radu/Projects/nuxt-apps/apps/bitvocation
git add tests/lightning/cancel-route.spec.ts
git commit -m "test: align lightning cancellation response"
```

### Task 2: Add the `blink_nc` Type and Configuration Surface

**Files:**
- Modify: `lightning/types/lightning.ts`
- Modify: `lightning/types/payment-events.ts`
- Modify: `lightning/server/utils/lightning-config.ts`
- Test: `lightning/tests/lightning-config.spec.ts`

**Interfaces:**
- Consumes: `LightningProvider`, `LightningConfig`, CouchDB `_config` resolver.
- Produces: `BlinkNcConfig`, `InvoiceLookupContext`, provider union membership, and validated config defaults.

- [ ] **Step 1: Write failing configuration tests**

Add cases to `lightning/tests/lightning-config.spec.ts` that assert:

```ts
readCouchConfigValuesMock.mockResolvedValueOnce({
  lightning_default_provider: "blink_nc",
  blink_nc_lightning_address: "Merchant@blink.sv",
});

const resolved = await resolveLightningConfigWithSources();
expect(resolved.config.defaultProvider).toBe("blink_nc");
expect(resolved.config.providers.blink_nc).toEqual({
  lightningAddress: "merchant@blink.sv",
  reconcileIntervalMs: 3000,
  settlementGraceMs: 120000,
  maxConcurrency: 5,
});
expect(formatLightningConfigSourceLog(resolved).join("\n"))
  .not.toContain("merchant@blink.sv");
```

Also assert missing active address fails with `blink_nc_lightning_address`, invalid domains fail closed, numeric bounds reject out-of-range values, and a configured non-default `blink_nc` remains in `providers`.

- [ ] **Step 2: Run the configuration tests and verify failure**

```bash
bunx vitest run --config lightning/vitest.config.ts lightning/tests/lightning-config.spec.ts
```

Expected: failures because `blink_nc` is not a recognized provider and its keys are unread.

- [ ] **Step 3: Add shared types**

Add these exact interfaces to `lightning/types/lightning.ts`:

```ts
export type LightningProviderName = "strike" | "alby" | "blink" | "nwc" | "blink_nc";

export interface InvoiceLookupContext {
  paymentRequest?: string;
  amount?: number;
  currency?: string;
  expiresAt?: Date | string;
  paymentContext?: Record<string, unknown>;
}

export interface BlinkNcConfig {
  lightningAddress: string;
  reconcileIntervalMs: number;
  settlementGraceMs: number;
  maxConcurrency: number;
}
```

Change `LightningProvider.getInvoiceStatus` to accept `context?: InvoiceLookupContext`, add `blink_nc?: BlinkNcConfig` to `LightningConfig.providers`, and add `blink_nc` to `PaymentProvider` in `types/payment-events.ts`.

- [ ] **Step 4: Implement CouchDB config parsing and redacted source notices**

Add these keys:

```ts
"blink_nc_lightning_address",
"blink_nc_reconcile_interval_ms",
"blink_nc_settlement_grace_ms",
"blink_nc_max_concurrency",
```

Use a bounded integer helper:

```ts
const parseBoundedInteger = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;
  const parsed = Number(String(value));
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`Lightning configuration integer must be between ${min} and ${max}`);
  }
  return parsed;
};
```

Normalize the address with an exact local-part/domain match:

```ts
const normalizeBlinkNcAddress = (value: string): string => {
  const match = /^([a-z0-9._+-]+)@blink\.sv$/i.exec(value.trim());
  if (!match) throw new Error("blink_nc_lightning_address must be username@blink.sv");
  return `${match[1].toLowerCase()}@blink.sv`;
};
```

Only address presence is required when `blink_nc` is default. Log source key names and presence, never the address value.

- [ ] **Step 5: Run focused tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/lightning-config.spec.ts
git add lightning/types lightning/server/utils/lightning-config.ts \
  lightning/tests/lightning-config.spec.ts
git commit -m "feat(lightning): configure blink non-custodial provider"
```

Expected: the configuration test file passes.

### Task 3: Implement the Bounded Blink LNURL/LUD-21 Client

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Create: `lightning/providers/blink-nc-client.ts`
- Create: `lightning/tests/blink-nc-client.spec.ts`

**Interfaces:**
- Consumes: `BlinkNcConfig`, injectable `fetch`, clock, Node `crypto`, `light-bolt11-decoder`.
- Produces: `createBlinkNcClient(options)` with `createInvoice`, `verifyInvoice`, and `probeConnection`.

```ts
export interface BlinkNcInvoiceRecord {
  paymentHash: string;
  bolt11: string;
  amountSats: number;
  expiresAt: Date;
  verifyUrl: string;
  lightningAddress: string;
  metadataHash: string;
}

export interface BlinkNcVerifyInput extends BlinkNcInvoiceRecord {}

export type BlinkNcVerifyResult =
  | { state: "pending"; invoice: BlinkNcInvoiceRecord }
  | { state: "paid"; invoice: BlinkNcInvoiceRecord; preimage: string }
  | { state: "proof_invalid"; invoice: BlinkNcInvoiceRecord; reason: string }
  | { state: "not_found"; invoice: BlinkNcInvoiceRecord; reason: string };
```

- [ ] **Step 1: Add the direct decoder dependency**

From `/Users/radu/Projects/nuxt-apps/layers` run:

```bash
bun add light-bolt11-decoder@^3.2.0
```

Confirm `package.json` lists it under `dependencies` and `bun.lock` changes only through Bun.

- [ ] **Step 2: Write failing address and HTTP-boundary tests**

Test exact `@blink.sv` acceptance and rejection of HTTP, credentials, ports, IPs, look-alike suffixes, redirects, responses over 256 KiB, 8-second aborts, non-JSON, and non-2xx bodies. Use injected `fetch` fixtures; never call live Blink.

Example assertion:

```ts
await expect(client.createInvoice({ amountSats: 21, description: "membership" }))
  .rejects.toThrow("Blink LNURL callback host is not allowed");
expect(fetchMock).not.toHaveBeenCalledWith(
  expect.stringContaining("169.254.169.254"),
  expect.anything(),
);
```

- [ ] **Step 3: Write failing LNURL and BOLT11 validation tests**

Use fixed BOLT11 fixtures to cover exact millisatoshi amount, mainnet network, payment hash, timestamp, expiry, and `description_hash === sha256(metadata)`. Add min/max inclusive boundary tests and existing callback-query preservation.

Assert the client returns the exact server-provided `verify` URL and otherwise derives:

```text
https://lnurl.blink.sv/verify/<paymentHash>
```

from the callback origin, never from the Lightning-address domain by assumption.

- [ ] **Step 4: Write failing strict-proof tests**

Cover `settled: false`, valid preimage, missing preimage, non-hex preimage, wrong digest, explicit `status: ERROR`, and a verification response `pr` whose payment hash differs from the persisted invoice.

The valid proof assertion is:

```ts
expect(await client.verifyInvoice(invoice)).toEqual({
  state: "paid",
  invoice,
  preimage: validPreimage,
});
```

The mismatched proof assertion must return `state: "proof_invalid"`, not throw `paid` and not substitute the returned `pr`.

- [ ] **Step 5: Run the client tests and verify module failure**

```bash
bunx vitest run --config lightning/vitest.config.ts lightning/tests/blink-nc-client.spec.ts
```

Expected: failure because `blink-nc-client.ts` does not exist.

- [ ] **Step 6: Implement the bounded JSON fetch helper**

Implement one internal helper with these exact defaults:

```ts
const HTTP_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 256 * 1024;

const response = await fetchImpl(url, {
  method: "GET",
  redirect: "manual",
  signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  headers: { Accept: "application/json" },
});
```

Reject 3xx responses, meter the response body before parsing, sanitize error messages, and validate every URL immediately before fetching it.

- [ ] **Step 7: Implement invoice creation validation**

Build metadata URL from the normalized address, validate `tag`, `metadata`, callback, min/max, and comment length, then decode the callback `pr`. Extract decoder sections through a local helper:

```ts
const getSection = <T>(decoded: DecodedBolt11, name: string): T | undefined =>
  decoded.sections.find((section) => section.name === name)?.value as T | undefined;
```

Require exact msats and compute:

```ts
const metadataHash = createHash("sha256").update(metadata, "utf8").digest("hex");
if (descriptionHash !== metadataHash) {
  throw new BlinkNcProtocolError("invoice_invalid", "BOLT11 description hash mismatch");
}
```

- [ ] **Step 8: Implement strict verification**

Decode the persisted BOLT11 again, require its hash and amount to match the input, and accept paid only through constant-time comparison:

```ts
const computed = createHash("sha256").update(Buffer.from(preimage, "hex")).digest();
const expected = Buffer.from(invoice.paymentHash, "hex");
const proofMatches = computed.length === expected.length && timingSafeEqual(computed, expected);
```

Return `proof_invalid` when `settled` is true without a matching proof. Do not expose the raw verification body in errors.

- [ ] **Step 9: Run tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts lightning/tests/blink-nc-client.spec.ts
git add package.json bun.lock lightning/providers/blink-nc-client.ts \
  lightning/tests/blink-nc-client.spec.ts
git commit -m "feat(lightning): add strict Blink LNURL client"
```

Expected: all protocol tests pass.

### Task 4: Adapt the Client to `LightningProvider` and Persisted Lookup Context

**Files:**
- Create: `lightning/providers/blink-nc.ts`
- Create: `lightning/tests/blink-nc-provider.spec.ts`
- Modify: `lightning/services/lightning.ts`
- Create: `lightning/tests/lightning-service.spec.ts`
- Modify: `lightning/utils/lightning.ts`
- Modify: `lightning/server/composables/useLightning.ts`

**Interfaces:**
- Consumes: `createBlinkNcClient`, `InvoiceRequest`, `InvoiceLookupContext`.
- Produces: `createBlinkNcProvider(config, client?)`, provider response mapping, service factory routing, and optional context propagation through utility/composable layers.

- [ ] **Step 1: Write failing provider mapping tests**

Test positive integer sats validation, non-sats rejection, client invoice mapping, context-required status lookup, strict proof mapping, and webhook no-ops.

Expected creation shape:

```ts
expect(await provider.createInvoice({ amount: 21, currency: "sats" })).toEqual({
  invoiceId: "a".repeat(64),
  id: "a".repeat(64),
  paymentRequest: "lnbc1persisted",
  amount: 21,
  currency: "sats",
  status: "pending",
  provider: "blink_nc",
  expiresAt,
  paymentContext: {
    protocol: "lnurl-lud21",
    lightningAddress: "merchant@blink.sv",
    verifyUrl: "https://lnurl.blink.sv/verify/hash",
    metadataHash: "b".repeat(64),
  },
});
```

- [ ] **Step 2: Run and verify provider test failure**

```bash
bunx vitest run --config lightning/vitest.config.ts lightning/tests/blink-nc-provider.spec.ts
```

Expected: module not found.

- [ ] **Step 3: Implement the provider adapter**

Map `pending` directly. Map `paid` only from the client's `state: "paid"`, and carry the verified proof only in the internal context:

```ts
paymentContext: {
  ...persistedContext,
  proofVerified: true,
  verifiedPreimage: result.preimage,
},
```

Map `proof_invalid` and `not_found` to a pending `InvoiceResponse` containing sanitized diagnostic flags in server context, never a paid status.

Require lookup context fields with explicit messages:

```ts
if (!context?.paymentRequest || !context.amount || !context.expiresAt) {
  throw new Error("blink_nc invoice lookup requires persisted invoice context");
}
```

Use `paymentContext.verifyUrl` when present. If missing, call the client's recovery resolver using the configured address and invoice ID.

Expose a provider-specific `probeConnection()` method that fetches and validates LNURL metadata but returns only min/max msats.

- [ ] **Step 4: Register the provider and prove context routing**

Create `lightning/tests/lightning-service.spec.ts` with a mocked provider factory and assert:

```ts
const response = await service.getInvoiceStatus("hash-1", "blink_nc", {
  paymentRequest: "lnbc1persisted",
  amount: 21,
  paymentContext: { verifyUrl: "https://lnurl.blink.sv/verify/hash-1" },
});
expect(getInvoiceStatusMock).toHaveBeenCalledWith("hash-1", expect.objectContaining({ amount: 21 }));
```

Import `createBlinkNcProvider` in `services/lightning.ts`, add a `case "blink_nc"`, require `config.providers.blink_nc`, and extend the service method:

```ts
const getInvoiceStatus = async (
  invoiceId: string,
  providerName?: LightningProviderName,
  context?: InvoiceLookupContext,
) => getProvider(providerName).getInvoiceStatus(invoiceId, context);
```

- [ ] **Step 5: Propagate optional lookup context**

Update `checkLightningInvoiceStatus`:

```ts
export async function checkLightningInvoiceStatus(
  config: LightningConfig,
  invoiceId: string,
  provider?: LightningProviderName,
  context?: InvoiceLookupContext,
): Promise<InvoiceResponse> {
  return createLightningService(config).getInvoiceStatus(invoiceId, provider, context);
}
```

Update `useLightning.checkPaymentStatus` to construct context from `currentPayment`, including `paymentRequest`, amount, currency, expiry, and `paymentContext`.

- [ ] **Step 6: Run focused tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/blink-nc-provider.spec.ts \
  lightning/tests/lightning-service.spec.ts
git add lightning/providers/blink-nc.ts lightning/tests/blink-nc-provider.spec.ts \
  lightning/services/lightning.ts lightning/tests/lightning-service.spec.ts \
  lightning/utils/lightning.ts lightning/server/composables/useLightning.ts
git commit -m "feat(lightning): adapt blink_nc provider contract"
```

### Task 5: Persist Internal Context and Sanitize Every Public Payment Response

**Files:**
- Create: `lightning/utils/public-payment.ts`
- Create: `lightning/tests/public-payment.spec.ts`
- Create: `lightning/tests/donation-route.spec.ts`
- Modify: `lightning/server/utils/payment-state.ts`
- Modify: `lightning/utils/orders.ts`
- Modify: `lightning/server/api/lightning/purchase.post.ts`
- Modify: `lightning/server/api/lightning/donation.post.ts`
- Modify: `lightning/server/api/lightning/career-hub-checkout.post.ts`
- Modify: `lightning/tests/payment-state.spec.ts`
- Modify: `lightning/tests/purchase-route.spec.ts`
- Modify: `lightning/tests/career-hub-checkout-route.spec.ts`

**Interfaces:**
- Consumes: full internal `PaymentInfo`/`InvoiceResponse`.
- Produces: normalized persisted `payment.providerContext` and `toPublicPaymentInfo()` with no verification capability or proof.

- [ ] **Step 1: Write failing normalized persistence tests**

Extend `payment-state.spec.ts` with a `blink_nc` invoice and assert:

```ts
expect(result.payment).toEqual(expect.objectContaining({
  provider: "blink_nc",
  providerInvoiceId: paymentHash,
  paymentRequest: "lnbc1persisted",
  amount: 21,
  currency: "sats",
  expiresAt: expiresAt.toISOString(),
  providerContext: expect.objectContaining({
    verifyUrl: "https://lnurl.blink.sv/verify/hash",
  }),
}));
```

- [ ] **Step 2: Write the failing public serializer test**

Create `public-payment.spec.ts` and pass an invoice containing `paymentContext.verifyUrl`, `payment.proof.preimage`, and Strike quote fields. Assert quote fields remain compatible while internal fields are absent:

```ts
expect(JSON.stringify(toPublicPaymentInfo(internal))).not.toContain("verify");
expect(JSON.stringify(toPublicPaymentInfo(internal))).not.toContain("preimage");
expect(toPublicPaymentInfo(internal)).toMatchObject({
  id: paymentHash,
  invoiceId: paymentHash,
  provider: "blink_nc",
  amount: 21,
});
```

- [ ] **Step 3: Run and verify failures**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/payment-state.spec.ts \
  lightning/tests/public-payment.spec.ts
```

Expected: missing normalized fields and serializer module.

- [ ] **Step 4: Normalize the persisted payment fields**

Update `createInvoicePaymentState` to copy provider, amount, currency, serialized expiry, and a cloned `paymentContext` into `payment.providerContext`. Update `applyInvoicePaymentStatus` to preserve these fields and never erase `payment.proof`.

- [ ] **Step 5: Implement an explicit public allowlist**

Define a local structural input type so the shared utility does not import the server composable and can accept either a provider response or the structurally compatible server payment object:

```ts
interface PublicPaymentSource {
  id?: string;
  invoiceId: string;
  paymentRequest?: string;
  amount: number;
  currency: string;
  status: LightningInvoiceStatus;
  expiresAt?: Date | string;
  provider?: LightningProviderName;
  quoteId?: string;
  rate?: number;
  sourceCurrency?: string;
  targetCurrency?: string;
  sourceAmount?: number;
  targetAmount?: number;
}

export const toPublicPaymentInfo = (invoice: PublicPaymentSource) => ({
  id: invoice.id || invoice.invoiceId,
  invoiceId: invoice.invoiceId,
  paymentRequest: invoice.paymentRequest || "",
  amount: invoice.amount,
  currency: invoice.currency,
  status: invoice.status,
  expiresAt: invoice.expiresAt || null,
  provider: invoice.provider,
  quoteId: invoice.quoteId,
  rate: invoice.rate,
  sourceCurrency: invoice.sourceCurrency,
  targetCurrency: invoice.targetCurrency,
  sourceAmount: invoice.sourceAmount,
  targetAmount: invoice.targetAmount,
});
```

Remove only `undefined` properties; never spread the input.

- [ ] **Step 6: Use the serializer in all creation routes**

Persist the full internal payment first. Return only `toPublicPaymentInfo(payment)` from donation, under `invoice` from purchase, and under the existing guest-checkout `invoice` response. Keep `checkoutToken` unchanged.

- [ ] **Step 7: Add route leak assertions**

Update purchase and Career Hub tests with an internal fixture containing `verifyUrl` and assert the serialized handler response excludes it. Create `lightning/tests/donation-route.spec.ts` with the equivalent internal fixture and leak assertion for the donation handler.

- [ ] **Step 8: Run route/persistence tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/payment-state.spec.ts \
  lightning/tests/public-payment.spec.ts \
  lightning/tests/purchase-route.spec.ts \
  lightning/tests/career-hub-checkout-route.spec.ts \
  lightning/tests/donation-route.spec.ts
git add lightning/utils/public-payment.ts lightning/server/utils/payment-state.ts \
  lightning/utils/orders.ts lightning/server/api/lightning \
  lightning/tests/payment-state.spec.ts lightning/tests/public-payment.spec.ts \
  lightning/tests/purchase-route.spec.ts lightning/tests/career-hub-checkout-route.spec.ts \
  lightning/tests/donation-route.spec.ts
git commit -m "fix(lightning): keep provider verification context server-only"
```

Expected: tests pass and no response contains `verifyUrl` or preimage.

### Task 6: Add the Strict, Idempotent Invoice Refresh Routine

**Files:**
- Create: `lightning/server/utils/blink-nc-payment-refresh.ts`
- Create: `lightning/tests/blink-nc-payment-refresh.spec.ts`
- Modify: `lightning/server/utils/payment-state.ts`

**Interfaces:**
- Consumes: persisted invoice, provider lookup, CouchDB operations, fulfilment, invoice-link update, payment-event log, and event bus.
- Produces: `refreshBlinkNcInvoice(options): Promise<BlinkNcRefreshResult>` and `expireUnsettledBlinkNcInvoice(options)` using the same deterministic event/idempotency path.

```ts
export interface BlinkNcRefreshResult {
  changed: boolean;
  status: LightningInvoiceStatus;
  invoiceDoc: CouchDBDocument;
  reason?: "unchanged" | "proof_invalid" | "already_processed";
}
```

- [ ] **Step 1: Write failing strict-transition tests**

Cover:

- verified paid response persists the preimage and paid status;
- provider/ID/amount/BOLT11 mismatch rejects before mutation;
- `proof_invalid` leaves invoice pending and performs no downstream calls;
- duplicate processed event is a no-op;
- invoice already paid with a failed event resumes fulfilment;
- cancellation wins over a concurrent pending refresh;
- three revision conflicts are bounded;
- post-grace expiration is deterministic and idempotent;
- one successful paid path calls linked updates, fulfilment, event-log completion, and `invoice.paid`/`order.fulfilled` publication exactly once.

- [ ] **Step 2: Run and verify module failure**

```bash
bunx vitest run --config lightning/vitest.config.ts lightning/tests/blink-nc-payment-refresh.spec.ts
```

Expected: module not found.

- [ ] **Step 3: Implement persisted invariant extraction**

Create narrow resolvers for provider, ID, BOLT11, amount, currency, expiry, context, and order ID. Reject missing fields with sanitized messages that include only the payment hash/document ID.

Call the provider with:

```ts
getInvoiceStatus(invoiceId, {
  paymentRequest,
  amount,
  currency,
  expiresAt,
  paymentContext: providerContext,
});
```

- [ ] **Step 4: Implement strict result checks and proof persistence**

Require `provider === "blink_nc"`, identical invoice ID, identical integer amount, `status === "paid"`, and `paymentContext.proofVerified === true`. Before mutating CouchDB, independently recompute `SHA256(verifiedPreimage)` in this lifecycle layer and compare it in constant time with the persisted payment hash. This defense-in-depth check makes the persisted BOLT11/payment hash authoritative even if the adapter regresses. Persist only the separately returned and reverified preimage:

```ts
payment: {
  ...invoiceDoc.payment,
  proof: {
    algorithm: "sha256",
    preimage,
    verifiedAt: eventTime,
  },
}
```

Do not accept a provider response that merely contains `status: "paid"` without `proofVerified` and the matching preimage.

- [ ] **Step 5: Implement deterministic event processing and conflicts**

Use provider event ID `blink_nc:${invoiceId}:paid`. Begin event processing before downstream side effects. Reload and retry revision conflicts at most three times. If the reloaded status is terminal `cancelled` or `expired`, stop; if it is already paid, continue unfinished fulfilment unless the event log is processed.

- [ ] **Step 6: Implement the explicit unsettled-expiry transition**

Add `expireUnsettledBlinkNcInvoice` beside refresh. It must reload the invoice, refuse to overwrite paid/cancelled/expired state, write `expired` through `payment-state.ts`, and use deterministic event ID `blink_nc:${invoiceId}:expired`. Publish `invoice.expired` exactly once and bound CouchDB revision retries to the same three attempts. This function is only callable after the reconciler has performed the final post-grace verification.

- [ ] **Step 7: Reuse fulfilment, links, and SSE**

After persisting paid:

```ts
await updateLinkedInvoiceDocuments({
  registryDatabaseName: ordersDatabase,
  webhookEvent: { invoiceId, status: "paid", timestamp: new Date(eventTime) },
  getView,
  getDocument,
  putDocument,
});
```

Load the order, call `applyInvoicePaidFulfillment`, publish `invoice.paid`, publish `order.fulfilled` only when an order exists, then mark the payment event processed. Mark it failed on downstream error without reverting paid state.

- [ ] **Step 8: Run tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/blink-nc-payment-refresh.spec.ts \
  lightning/tests/payment-state.spec.ts
git add lightning/server/utils/blink-nc-payment-refresh.ts \
  lightning/server/utils/payment-state.ts \
  lightning/tests/blink-nc-payment-refresh.spec.ts
git commit -m "feat(lightning): apply strict blink_nc payment transitions"
```

### Task 7: Add Adaptive Reconciliation and Protocol-Aware Expiry

**Files:**
- Create: `lightning/server/utils/blink-nc-reconciliation.ts`
- Create: `lightning/server/plugins/blink-nc-payment-reconciliation.ts`
- Create: `lightning/tests/blink-nc-reconciliation.spec.ts`
- Create: `lightning/tests/pending-invoice-expiration.spec.ts`
- Modify: `lightning/server/utils/pending-invoice-expiration.ts`

**Interfaces:**
- Consumes: `refreshBlinkNcInvoice`, `getView`, resolved config, provider factory.
- Produces: pure `getBlinkNcPollDelay`, `reconcileBlinkNcBatch`, and a non-overlapping single-instance plugin.

- [ ] **Step 1: Write failing scheduling tests**

Use an injected clock and assert:

```ts
expect(getBlinkNcPollDelay({ ageMs: 60_000, phase: "pending", failures: 0 })).toBe(3_000);
expect(getBlinkNcPollDelay({ ageMs: 180_000, phase: "pending", failures: 0 })).toBe(10_000);
expect(getBlinkNcPollDelay({ ageMs: 0, phase: "grace", failures: 0 })).toBe(30_000);
expect(getBlinkNcPollDelay({ ageMs: 0, phase: "pending", failures: 8 })).toBe(30_000);
```

Test concurrency never exceeds config, one invoice failure does not stop siblings, and an overlapping batch returns without starting work.

- [ ] **Step 2: Write failing expiry-grace tests**

Assert an invoice before expiry remains pending, during grace remains eligible, and after `expiresAt + settlementGraceMs` performs one final provider refresh before an expired transition/event. A valid proof on the final check must win and settle paid.

- [ ] **Step 3: Write the generic expiration exclusion test**

Create `pending-invoice-expiration.spec.ts` and assert `isStalePendingInvoice` returns false for both `nwc` and `blink_nc`, including legacy provider placement under `invoiceData`.

- [ ] **Step 4: Run tests and verify failures**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/blink-nc-reconciliation.spec.ts \
  lightning/tests/pending-invoice-expiration.spec.ts
```

- [ ] **Step 5: Implement pure scheduler and batch helpers**

Maintain `Map<string, { failures: number; nextAttemptAt: number }>` outside the pure helper and pass it into each batch. Use a small worker pool rather than `Promise.all` over all invoices. The batch result records checked, skipped, paid, expired, proof-invalid, and failed counts.

For post-grace final verification, call refresh first. If it remains pending or proof-invalid, call the refresh helper's explicit `expireUnsettledBlinkNcInvoice` path so expiration uses the same event log, state transition, and SSE conventions.

- [ ] **Step 6: Implement the Nitro plugin**

Use a global symbol state to avoid hot-reload duplication:

```ts
const STATE_KEY = Symbol.for("couchfusion.lightning.blink_nc.reconciliation");
type RuntimeState = {
  timer?: ReturnType<typeof setInterval>;
  running: boolean;
  attempts: Map<string, AttemptState>;
};
```

Start whenever `config.providers.blink_nc` exists. Probe metadata once, log strict-proof mode and timing values without the address, run reconciliation immediately, then schedule at `reconcileIntervalMs`. Query `by_provider_and_status` with `key: ["blink_nc", "pending"]`.

- [ ] **Step 7: Exclude `blink_nc` from generic expiry**

Change:

```ts
if (["nwc", "blink_nc"].includes(resolveInvoiceProvider(invoiceDoc))) {
  return false;
}
```

- [ ] **Step 8: Run tests and commit**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/blink-nc-reconciliation.spec.ts \
  lightning/tests/pending-invoice-expiration.spec.ts \
  lightning/tests/blink-nc-payment-refresh.spec.ts
git add lightning/server/utils/blink-nc-reconciliation.ts \
  lightning/server/plugins/blink-nc-payment-reconciliation.ts \
  lightning/server/utils/pending-invoice-expiration.ts \
  lightning/tests/blink-nc-reconciliation.spec.ts \
  lightning/tests/pending-invoice-expiration.spec.ts
git commit -m "feat(lightning): reconcile blink_nc invoices"
```

### Task 8: Verify All Lightning Creation Routes and Startup Behavior

**Files:**
- Modify: `lightning/server/plugins/init.ts`
- Create: `lightning/tests/blink-nc-init.spec.ts`
- Modify: `lightning/tests/purchase-route.spec.ts`
- Modify: `lightning/tests/career-hub-checkout-route.spec.ts`
- Modify: `lightning/tests/donation-route.spec.ts`
- Modify: `lightning/tests/lightning-config.spec.ts`

**Interfaces:**
- Consumes: registered provider, public serializer, canonical persistence, reconciler plugin.
- Produces: provider-neutral route compatibility and redacted startup notices.

- [ ] **Step 1: Add a failing purchase integration case**

Mock resolved config with `defaultProvider: "blink_nc"`, return a provider invoice with internal verification context, and assert:

- the internal document sent to `putDocument` contains the exact `verifyUrl`;
- the route response contains BOLT11, amount, provider, status, and expiry;
- serialized response JSON contains neither `verifyUrl` nor `preimage`.

- [ ] **Step 2: Add equivalent donation and Career Hub cases**

For donation, assert best-effort persistence still receives the internal record while the response is sanitized. For Career Hub, assert the capability token remains unchanged and only the public invoice subset is returned.

- [ ] **Step 3: Run route tests and verify any missing wiring**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/purchase-route.spec.ts \
  lightning/tests/donation-route.spec.ts \
  lightning/tests/career-hub-checkout-route.spec.ts
```

- [ ] **Step 4: Add and test startup behavior without webhook setup**

Keep `init.ts` provider setup branches limited to Strike and custodial Blink webhooks. Add a notice for `blink_nc` stating reconciliation performs connection probing. Do not construct an `/api/webhooks/blink_nc` route. Create `lightning/tests/blink-nc-init.spec.ts` that initializes with `defaultProvider: "blink_nc"` and proves no webhook registration/setup helper is called and no address value is logged.

- [ ] **Step 5: Run config, startup-adjacent, and route tests**

```bash
bunx vitest run --config lightning/vitest.config.ts \
  lightning/tests/lightning-config.spec.ts \
  lightning/tests/blink-nc-init.spec.ts \
  lightning/tests/purchase-route.spec.ts \
  lightning/tests/donation-route.spec.ts \
  lightning/tests/career-hub-checkout-route.spec.ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add lightning/server/plugins/init.ts lightning/server/api/lightning \
  lightning/tests/lightning-config.spec.ts lightning/tests/blink-nc-init.spec.ts \
  lightning/tests/purchase-route.spec.ts \
  lightning/tests/donation-route.spec.ts lightning/tests/career-hub-checkout-route.spec.ts
git commit -m "test(lightning): cover blink_nc creation flows"
```

### Task 9: Validate Provider-Neutral Bitvocation UI Behavior

**Files:**
- Modify: `apps/bitvocation/tests/lightning/use-payment-notifications.spec.ts`
- Modify: `apps/bitvocation/tests/lightning/subscription-confirmation-height.spec.ts`
- Inspect without modifying unless a test proves necessary: `apps/bitvocation/app/components/SubscriptionWidget.vue`
- Inspect without modifying unless a test proves necessary: `apps/bitvocation/app/components/LiteSubscriptionWidget.vue`
- Inspect without modifying unless a test proves necessary: `apps/bitvocation/app/components/CareerHubGuestCheckoutModal.vue`

**Interfaces:**
- Consumes: existing public invoice response, CouchDB status endpoint, payment SSE.
- Produces: evidence that `blink_nc` needs no provider-specific frontend branch.

- [ ] **Step 1: Add a `blink_nc` paid-event fixture**

In `use-payment-notifications.spec.ts`, emit:

```ts
{
  id: `blink_nc:${paymentHash}:paid`,
  type: "invoice.paid",
  provider: "blink_nc",
  invoiceId: paymentHash,
  status: "paid",
  createdAt: "2026-08-21T12:00:00.000Z",
}
```

Assert `onPaid` and `refreshStatus` run once without checking a custodial-provider name.

- [ ] **Step 2: Prove both subscription widgets are provider-name neutral**

Extend the existing static-source test in `subscription-confirmation-height.spec.ts` to load both `SubscriptionWidget.vue` and `LiteSubscriptionWidget.vue`, then assert neither source contains a Blink-provider branch:

```ts
expect(subscriptionSource).not.toMatch(/provider\s*===\s*["']blink(?:_nc)?["']/);
expect(liteSubscriptionSource).not.toMatch(/provider\s*===\s*["']blink(?:_nc)?["']/);
```

Keep the existing layout assertions. The SSE fixture in Step 1 covers the runtime `blink_nc` event shape; this static check guards the provider-neutral UI contract without inventing a component harness that the current test does not use.

- [ ] **Step 3: Run focused Bitvocation tests**

From `/Users/radu/Projects/nuxt-apps`:

```bash
layers/node_modules/.bin/vitest \
  --config layers/bitvocation-content.vitest.config.ts \
  apps/bitvocation/tests/lightning/use-payment-notifications.spec.ts \
  apps/bitvocation/tests/lightning/subscription-confirmation-height.spec.ts \
  apps/bitvocation/tests/lightning/cancel-route.spec.ts \
  --run
```

Expected: all tests pass without production Vue changes.

- [ ] **Step 4: If and only if a test exposes a provider-name branch, remove that branch**

The allowed production change is to key UI behavior from public fields/status:

```ts
const hasInvoice = computed(() => Boolean(invoice.value?.paymentRequest));
const isPaid = computed(() => invoice.value?.status === "paid");
```

Do not add `if (provider === "blink_nc")` UI code.

- [ ] **Step 5: Commit Bitvocation validation tests**

```bash
cd /Users/radu/Projects/nuxt-apps/apps/bitvocation
git add tests/lightning/use-payment-notifications.spec.ts \
  tests/lightning/subscription-confirmation-height.spec.ts
git commit -m "test: validate blink_nc payment notifications"
```

### Task 10: Document Configuration, Operations, and Validation

**Files:**
- Create: `lightning/README_blink_nc.md`
- Modify: `lightning/agents.md`
- Modify: `apps/bitvocation/README.md`
- Create at execution completion under `lightning/docs/implementation_results/`: a file named from the then-current normalized ISO timestamp plus `_blink-nc-provider.md`.
- Create at execution completion under `apps/bitvocation/docs/implementation_results/`: a file named from the same timestamp plus `_blink-nc-bitvocation-validation.md`.

**Interfaces:**
- Consumes: final configuration names, defaults, strict proof behavior, and test evidence.
- Produces: operator-ready setup/runbook and repository-required implementation records.

- [ ] **Step 1: Write the Lightning provider runbook**

Include this exact CouchDB example:

```ini
[cf_env_bitvocation]
lightning_default_provider=blink_nc
blink_nc_lightning_address=merchant@blink.sv
blink_nc_reconcile_interval_ms=3000
blink_nc_settlement_grace_ms=120000
blink_nc_max_concurrency=5
```

Document mainnet-only receiving, no webhook/API key/seed, strict preimage proof, adaptive polling, single-instance restriction, redacted logs, provider-switch recovery, and rollback by restoring the previous default provider while leaving the address configured until pending invoices finish.

- [ ] **Step 2: Update the Lightning agent map**

Add `blink_nc` to provider names, provider files, config keys, plugin list, test commands, public API notes, and gotchas. State that its exact verify URL and proof are server-only and its expiry is not owned by the generic heartbeat.

- [ ] **Step 3: Update Bitvocation README**

Replace outdated runtime-config payment setup language with CouchDB `_config` instructions. Describe the staged rollout: configure while another default remains active, validate low-value payment/restart recovery, then select `blink_nc`.

- [ ] **Step 4: Create execution-time implementation records**

At implementation completion, obtain the filename prefix with:

```bash
date '+%Y-%m-%dT%H-%M-%S%z'
```

Use that exact output as each filename prefix. Each record must contain Initial Prompt, Plan Followed, Implementation Summary, Verification Evidence, Known Limitations, and Proposed Next Steps. Do not claim a live payment was tested unless the operator-authorized smoke test actually occurred.

- [ ] **Step 5: Commit documentation in each repository**

```bash
cd /Users/radu/Projects/nuxt-apps/layers
git add lightning/README_blink_nc.md lightning/agents.md \
  lightning/docs/implementation_results
git commit -m "docs(lightning): document blink_nc operations"

cd /Users/radu/Projects/nuxt-apps/apps/bitvocation
git add README.md docs/implementation_results
git commit -m "docs: record blink_nc validation"
```

### Task 11: Full Automated Verification and Manual Mainnet Handoff

**Files:**
- No production changes unless a verification failure identifies a scoped defect.
- Update the execution-time implementation records with actual command output summaries.

**Interfaces:**
- Consumes: complete implementation and documentation.
- Produces: final automated evidence plus a separately authorized mainnet checklist.

- [ ] **Step 1: Run formatting safety checks in both repositories**

```bash
git -C /Users/radu/Projects/nuxt-apps/layers diff --check
git -C /Users/radu/Projects/nuxt-apps/apps/bitvocation diff --check
```

Expected: no whitespace errors.

- [ ] **Step 2: Run the complete Lightning suite**

```bash
cd /Users/radu/Projects/nuxt-apps/layers
bunx vitest run --config lightning/vitest.config.ts
```

Expected: every original test and every new `blink_nc` test passes; no baseline failure remains.

- [ ] **Step 3: Run focused Bitvocation Lightning tests**

```bash
cd /Users/radu/Projects/nuxt-apps
layers/node_modules/.bin/vitest \
  --config layers/bitvocation-content.vitest.config.ts \
  apps/bitvocation/tests/lightning \
  --run
```

Expected: every discovered focused Lightning spec passes.

- [ ] **Step 4: Run the consuming-app typecheck**

```bash
cd /Users/radu/Projects/nuxt-apps/apps/bitvocation
./node_modules/.bin/nuxt typecheck
```

Expected: exit 0. Do not substitute `bun run build` and do not run final lint.

- [ ] **Step 5: Audit the public-data boundary**

Search production routes and event payloads:

```bash
rg -n "verifyUrl|preimage|providerContext" \
  /Users/radu/Projects/nuxt-apps/layers/lightning/server/api \
  /Users/radu/Projects/nuxt-apps/layers/lightning/types/payment-events.ts
```

Expected: no serializer bypass or event field exposes the values. Intentional internal references must stay behind the serializer.

- [ ] **Step 6: Audit acceptance-criterion coverage**

Compare the final diff with `lightning/docs/superpowers/specs/2026-08-21-blink-nc-provider-design.md`. For every acceptance criterion, record the exact passing test name in the Lightning implementation result.

- [ ] **Step 7: Hand the operator the mainnet smoke-test checklist**

Do not spend sats automatically. After explicit authorization, the operator or authorized agent should:

1. configure the real Spark address while leaving the current provider default;
2. restart Bitvocation and confirm the redacted connection probe;
3. create one capped low-value invoice through a test product;
4. confirm its CouchDB document has internal verification context and the browser response does not;
5. pay from a separate wallet;
6. confirm strict proof, paid invoice, active/fulfilled order, user membership or guest account, queued emails, SSE UI completion, and processed event log;
7. repeat with Nitro stopped during payment, then restart and confirm reconciliation recovery;
8. restore the previous default immediately if any invariant or fulfilment check fails.

- [ ] **Step 8: Commit only verification-driven fixes and final evidence**

If verification required code fixes, repeat the failing focused test before the full suites. Commit final implementation records after their evidence is complete; do not amend them to claim unperformed live validation.

---

## Execution Order and Review Gates

- Tasks 1–4 establish a green baseline, shared surface, protocol client, and provider contract.
- Task 5 is a security gate: no background settlement work begins until the public verification context is proven non-leaking.
- Tasks 6–8 implement and integrate the authoritative server lifecycle.
- Task 9 validates Bitvocation without provider-specific UI code.
- Tasks 10–11 document and verify. The live mainnet test remains a separately authorized operational action.

Each task ends in an independently reviewable commit. Do not combine the layers and Bitvocation repositories in one commit, and do not switch Bitvocation's production `lightning_default_provider` as part of source-code implementation.
