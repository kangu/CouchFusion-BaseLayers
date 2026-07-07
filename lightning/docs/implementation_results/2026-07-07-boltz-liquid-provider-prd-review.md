# Boltz Liquid Provider PRD Review Update

Updated `/Users/radu/Projects/nuxt-apps/layers/lightning/docs/2026-07-07-boltz-liquid-provider-prd.md` after reviewing implementation-planning feedback against the current lightning layer.

Changes made:

- Made the gRPC strategy explicit: vendor Boltz Client's pinned `pkg/boltzrpc/boltzrpc.proto`, generate TypeScript bindings, use `@grpc/grpc-js`, and avoid build-time proto fetching.
- Added required provider/status type surfaces beyond `types/lightning.ts`, including `server/composables/useLightning.ts`, `utils/lightning.ts`, `types/payment-events.ts`, and `donation.post.ts`.
- Resolved the `failed` status mismatch by requiring public invoice/payment status types to include `failed`.
- Reworked Boltz status semantics so refunded/settlement-error states map to `failed`, not `cancelled`.
- Added explicit amount and fee semantics for order amount, BOLT11 invoice amount, settlement amount, service fee, and on-chain fee.
- Specified CouchDB provider/status view fixes for nested `invoiceData.provider` and `invoiceData.status`.
- Stated that Boltz invoices must be exempt from the generic one-hour pending invoice expiration heartbeat.
- Replaced CouchDB secret-value config with disk path config for macaroons/certs.
- Removed the undefined `disabled` binary mode.
- Clarified Debian deployment ownership: `boltzd` runs under a dedicated daemon user, while Nuxt receives only client gRPC credentials.
- Defined the deployment script as an explicit deploy/provisioning step, not a Nuxt build or startup hook.
- Added release verification details using the Boltz manifest signature, SHA256 manifest, and published signing key fingerprint.
- Added admin-auth requirements for the Boltz health endpoint.
- Promoted single-instance Nitro from an open question to a v1 constraint.

Verification:

- Inspected the current lightning layer type, config, view, purchase, fulfillment, and expiration files.
- Checked the upstream Boltz Client proto location and current release verification instructions.
