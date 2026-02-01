# Persist Lightning Invoice Code

## Initial Prompt
"Upon receiving a successful Lightning Invoice Creation, persist the invoice code as a document to the Order's database."

## Implementation Summary (2026-02-01)
- Added a dedicated helper `saveInvoiceCodeToDatabase` to store the raw invoice code (payment request) as a lightweight document keyed by `invoice-code-{invoiceId}`.
- Updated the lightning purchase handler to save this document right after invoice creation, without failing the purchase flow if persistence fails.

### Files Modified
- `layers/lightning/utils/orders.ts`
  - New types: `SaveInvoiceCodeOptions`, `InvoiceCodeDocument`.
  - New helper: `saveInvoiceCodeToDatabase` saving `{orderId, invoiceId, code, provider, userName, timestamp}` to `${dbLoginPrefix}-orders`.
- `layers/lightning/server/api/lightning/purchase.post.ts`
  - Calls `saveInvoiceCodeToDatabase` after successful invoice creation; logs errors but keeps response successful.

### Data Model
- Document ID: `invoice-code-{invoiceId}`
- Type: `invoice_code`
- Fields: `timestamp`, `orderId`, `invoiceId`, `code` (payment request), `provider?`, `userName`

### Notes
- Uses the same AuthSession-derived user context as other order/invoice docs.
- Non-blocking: failures to persist the code are logged and do not break the purchase API response.
