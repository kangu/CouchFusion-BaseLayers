# Blink donation webhook missing-order tolerance

## Summary
Donation invoices in the lightning layer are invoice-only flows. They persist invoice data but do not create a corresponding order document.

## Fix
The Blink webhook route now tolerates missing order documents when processing invoice updates:
- `updateOrderDocument()` returns `false` when the order document does not exist
- the route logs a warning and continues
- webhook processing still returns success after the invoice document update

## Why
Blink retries webhook delivery on server errors. Failing the route for invoice-only donations caused repeated webhook deliveries even though the invoice document had already been updated.

## Verification
- `bunx vitest --config vitest.config.ts lightning/tests/blink-webhook-route.spec.ts --run`
- `bunx vitest --config vitest.config.ts lightning/tests/blink-provider.spec.ts --run`
