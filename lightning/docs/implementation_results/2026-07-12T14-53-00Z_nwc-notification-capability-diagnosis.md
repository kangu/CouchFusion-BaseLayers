# NWC Live Notification Capability Diagnosis

## Initial Prompt

Run the Bitvocation Bun development server, add enough NWC diagnostics, and determine why live invoice-payment detection is missed.

## Findings

The server started successfully with the NWC provider selected. The capability probe returned:

```text
methods: [make_invoice, make_hold_invoice, settle_hold_invoice, cancel_hold_invoice, lookup_invoice, get_info, get_budget]
notifications: []
paymentReceivedSupported: false
```

The NWC client subscription starts, but the wallet does not advertise `payment_received`; therefore no live NWC notification can trigger the invoice refresh. Settlements are detected only by the configured 60-second reconciliation loop, after which the normal CouchDB update and browser SSE pipeline complete immediately.

## Implementation Summary

- Added a secret-safe wallet capability probe to the NWC adapter/provider/plugin.
- Startup logs now report supported NWC methods, notification types, and whether `payment_received` is available.
- Added a unit test for capability diagnostics.

## Verification

- `bunx vitest run --config lightning/vitest.config.ts` — passed (14 files, 59 tests).
- Started `bun run dev` in `apps/bitvocation` and observed the live capability output above.

## Next Steps

1. In Alby Hub, edit or recreate the Bitvocation app connection with received-payment notification capability if the Hub version exposes it.
2. If the wallet still reports no notification capability, retain reconciliation as the authoritative mechanism and set `nwc_reconcile_interval_ms=10000` for Bitvocation, then restart Nitro.
