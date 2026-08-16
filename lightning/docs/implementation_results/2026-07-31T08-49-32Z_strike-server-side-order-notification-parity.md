# Strike Server-Side Order Notification Parity

## Initial Prompt

Check the rules from `/Users/radu/Projects/nuxt-apps/cli-configs-bitvocation/config-orders.json` and make sure they are implemented in the server-side step. Make sure all scenarios are covered, for the pow lab lite and also for the conference submission.

## Plan

1. Compare every legacy invoice-created and invoice-paid rule with the shared webhook fulfillment helper.
2. Add failing tests for Pow Lab and Lite notification templates, payloads, and conference no-email behavior.
3. Implement server-side notification queueing through the email layer with invoice-level retry markers.
4. Verify Strike and Blink webhook parity plus invoice-created and invoice-paid product scenarios.

## Implementation Summary

- The Lightning layer now declares the email layer as a dependency and uses `queueTemplateEmail` during paid membership fulfillment.
- Pow Lab paid invoices queue:
  - `welcome_to_pow_lab` to the member with `user_email` and `subscription_end_date`;
  - `admin_order` to `settings.orderNotifications.recipientEmail` with the member email, sats, referral source, Telegram handle, and invoice timestamp.
- Pow Lab Lite queues the matching Lite templates and includes `product: "pow_lab_lite"` in both payloads.
- Conference submissions retain the legacy pending-payment and paid user-state transitions and intentionally do not queue email.
- Successful customer/admin queue operations are recorded individually on the invoice fulfillment document. If an event is retried after one queue succeeds, that template is skipped and only the unfinished notification is queued.
- Queue failures flow back to the webhook's existing payment-event log as `failed`, preserving operational visibility and retry eligibility instead of silently treating the event as complete.
- Added tests for Pow Lab Lite and conference invoice-created behavior, membership notification payloads, per-template retry markers, Strike queue-failure recording, and Blink notification parity.

## Verification

Passed:

```bash
node node_modules/vitest/vitest.mjs run --config lightning/vitest.config.ts \
  lightning/tests/order-fulfillment.spec.ts \
  lightning/tests/strike-webhook-route.spec.ts \
  lightning/tests/blink-webhook-route.spec.ts
```

Result: 3 test files passed, 19 tests passed.

Also passed:

```bash
git diff --check
```

## Proposed Next Steps

1. Deploy the `webhook-updates` branch and perform one real paid Pow Lab and Pow Lab Lite transaction; confirm both customer and admin emails are queued in the email-sender database.
2. Monitor `payment_event` documents for `processingStatus: "failed"`; those identify membership activations whose required notification queue operation needs replaying.
3. Retire or archive the now-obsolete paid-order email rules in `cli-configs-bitvocation/config-orders.json` after production confirmation, so a monitor restart cannot double-queue notifications.
