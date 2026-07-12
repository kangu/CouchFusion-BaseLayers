# Lightning Layer Feature Readiness Review

## Scope

Reviewed the current `layers/lightning` code, its local history, the four declared consuming applications, the CouchDB configuration path, and the current Boltz Liquid provider PRD.

## Current State

- Existing provider support is implemented for Strike, Blink, and Alby. Strike and Blink have webhook routes; Alby is polling-only/no-webhook.
- Runtime provider credentials are resolved from CouchDB `_config` sections named `cf_env_[app-slug]`. `lightning_default_provider` is required and active-provider credential checks are correctly provider-scoped.
- Purchase invoices are persisted to the app orders database, normalized through `payment-state.ts`, and use the fulfillment, payment event log, payment event bus/SSE, and invoice-link bridge paths.
- The generic pending-invoice heartbeat runs hourly and expires stale invoices after one hour. It is currently designed for a single Nitro instance.
- No Boltz provider, gRPC client, generated bindings, poller, deployment provisioner, or health route exists yet. Boltz remains a PRD-only feature.

## Verification

- Passed: `bunx vitest run layers/lightning/tests` — 22 files and 96 tests.
- Failed before test discovery: `bunx vitest run --config layers/lightning/vitest.config.ts`.
  - Cause: `layers/lightning/vitest.config.ts` uses `./lightning/tests/**`, which is resolved from the repository root and does not match `layers/lightning/tests/**`.
  - Consequence: the command documented in `agents.md` is currently unusable, even though the test suite itself passes through the fallback command.

## Feature Readiness: Boltz Liquid Settlement

The PRD is detailed and internally aligned with the modern invoice lifecycle, but implementation must begin with groundwork rather than directly adding a provider.

### Required foundations

1. Repair the layer-local Vitest config and make its documented command pass.
2. Introduce shared `LightningProviderName` and `LightningInvoiceStatus` aliases, including `boltz` and `failed`, then use them across public types, the server composable, utility helpers, donation input, and payment event types.
3. Extend the CouchDB config resolver and validation with Boltz path/config values. Credentials must remain file paths and CouchDB must not store macaroons, certificates, seeds, or wallet material.
4. Repair the `by_provider` and `by_provider_and_status` design-document views so they resolve provider/status from normalized and legacy invoice shapes. The current maps only read top-level provider fields and cannot reliably drive a Boltz pending-invoice poller.
5. Exempt resolved Boltz invoices from the generic one-hour expiration helper before any Boltz status polling is enabled.

### Provider and operations sequence

6. Vendor a tagged `boltzrpc.proto`, commit generated `grpc-js` TypeScript bindings, and add a mocked adapter test seam. Do not fetch the proto at build/startup.
7. Implement the provider with sats-only reverse-swap creation, typed payment context, explicit fee/amount fields, and the defined `failed` mapping for settlement/refund errors.
8. Add purchase preflight before `createOrder` so unsupported amounts cannot leave orphan orders.
9. Add the single-instance status poller using `lightning/by_provider_and_status` with `["boltz", "pending"]`; reuse payment state, event logging, fulfillment, event bus, and invoice-link helpers for terminal transitions.
10. Add the Debian-only, idempotent provisioning path separately from Nuxt runtime: pinned release verification, a dedicated daemon user, and an app-owned systemd sidecar. Use mocks/Docker or a remote daemon for macOS development.

## Risks To Resolve Before Enabling Boltz

- Fee policy is still an open product decision: buyer-paid versus settlement-absorbed affects the invoice shown to purchasers, not just internal accounting.
- The current layer has no gRPC runtime or code-generation dependency; dependency choice and pinned Boltz Client version need to be selected together.
- Current webhook/event idempotency is well-tested, but the new poller needs its own transition concurrency/idempotency tests because it has no upstream provider event id.
- Consuming app `runtimeConfig.lightning` objects are legacy/stale for the CouchDB-only resolver; app opt-in must happen through the correct `cf_env_[slug]` section.
- The layer carries app-specific fulfillment mappings (`pow_lab`, `pow_lab_lite`, `conference_submission`). Boltz must preserve those paths rather than introduce a parallel fulfillment mechanism.

## Recommended First Implementation Slice

Implement and test the foundations through generic-expiration exclusion first. This is independently reviewable, keeps all non-Boltz consumers behaviorally unchanged, and creates a safe base for the adapter/provider work.
