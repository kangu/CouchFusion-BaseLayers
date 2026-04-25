# Invoice Link Webhook Bridge

## Initial Prompt

Support Developers Hub anonymous invoice streaming by making Lightning webhooks update linked domain documents, not only legacy order invoice documents.

## Plan

1. Add a reusable invoice-link document contract in the Lightning layer.
2. Extend the Lightning CouchDB design document with invoice-link views.
3. Update Blink webhook processing to update linked domain documents by invoice id.
4. Preserve existing legacy order invoice behavior when matching order invoice documents exist.
5. Verify through the CouchFusion Developers Hub focused tests.

## Implementation Summary

- Added `server/utils/invoice-links.mjs` with helpers for `lightning_invoice_link` creation and webhook status application.
- Added declaration file `server/utils/invoice-links.mjs.d.ts`.
- Extended `_design/lightning` with `invoice_links_by_invoice_id` and `invoice_links_by_purpose`.
- Updated Blink webhook handling so missing legacy order invoice docs no longer abort webhook processing.
- Blink webhooks now call `updateLinkedInvoiceDocuments`, allowing app/domain documents such as Developers Hub membership invoices and feature donations to receive status updates from CouchDB.

## Verification

- Ran the CouchFusion Developers Hub focused test suite that includes the Lightning bridge source contract.
- Result: 29 tests passed.
- Ran `bunx nuxi prepare` in `apps/couchfusioncom`.
- Result: Nuxt types generated.

## Next Steps

1. Add provider parity for Strike after Blink is verified in local beta.
2. Add a direct Lightning-layer unit test suite for `invoice-links.mjs` if the layer test harness is expanded.
