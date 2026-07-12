# NWC Payment Pipeline Observability

## Initial Prompt

Investigate why an NWC payment appeared to settle without visible server logs or a visible client SSE request, then make the pipeline traceable.

## Implementation Summary

- Added structured, secret-safe NWC logs for notification receipt, invoice lookup, unchanged status, persisted status transitions, paid fulfilment, reconciliation startup, and SSE publication.
- Added the payment owner to NWC-published SSE events so scoped delivery has complete event context.
- Added a regression assertion that a verified paid NWC invoice publishes `invoice.paid` with invoice, order, and user identity.

## Operational Trace

For a paid checkout the server now emits:

```text
[lightning][nwc] payment notification subscription active
[lightning][nwc] reconciliation started { intervalMs: 60000 }
[lightning][nwc] payment notification received { invoiceId }
[lightning][nwc] invoice lookup started { invoiceId }
[lightning][nwc] invoice transition persisted { invoiceId, from, to, orderId }
[lightning][nwc] paid invoice fulfilment completed { invoiceId, orderId }
[lightning][nwc] SSE payment event published { invoiceId, status, orderId }
```

No NWC URI, relay, secret, or invoice payload is logged.

## Verification

- `bunx vitest run --config lightning/vitest.config.ts lightning/tests/nwc-payment-refresh.spec.ts` — passed (2 tests).
- `bunx vitest run --config lightning/vitest.config.ts` — passed (14 files, 58 tests).

## Next Step

Restart the Bitvocation Nitro process before the next NWC checkout so the updated plugin and logs are loaded. Keep browser DevTools open and verify the scoped `/api/lightning/events?invoiceId=<id>` request remains open until the `invoice.paid` event arrives.
