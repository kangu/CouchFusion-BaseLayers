# Add Blink Provider to Lightning Layer

## Summary

Added a new `blink` Lightning provider to `layers/lightning`.

The provider is implemented against Blink's hosted GraphQL API and supports:

- creating BTC Lightning receive invoices
- auto-discovering the account BTC wallet when `walletId` is not configured
- polling invoice status by payment hash
- best-effort `receive.lightning` webhook processing with status re-fetch
- callback endpoint creation/list/delete through Blink's GraphQL API

## Configuration

Runtime config additions:

```ts
runtimeConfig: {
  lightning: {
    defaultProvider: 'blink',
    providers: {
      blink: {
        apiKey: process.env.NUXT_BLINK_API_KEY,
        apiUrl: process.env.NUXT_BLINK_API_URL,
        walletId: process.env.NUXT_BLINK_WALLET_ID,
        webhookUrl: process.env.NUXT_BLINK_WEBHOOK_URL,
        webhookEndpointId: process.env.NUXT_BLINK_WEBHOOK_ENDPOINT_ID
      }
    }
  }
}
```

Environment variables:

```bash
NUXT_BLINK_API_KEY=blink_...
NUXT_BLINK_API_URL=https://api.blink.sv/graphql
NUXT_BLINK_WALLET_ID=<optional-btc-wallet-id>
NUXT_BLINK_WEBHOOK_URL=https://your-app.example/api/webhooks/blink
NUXT_BLINK_WEBHOOK_ENDPOINT_ID=<optional-existing-endpoint-id>
```

## Behavior Decisions

- Blink is BTC-wallet only in this implementation.
- Invoice amounts are still sats-only at the lightning-layer boundary.
- The canonical invoice identifier is Blink `paymentHash`.
- Webhooks are treated as best-effort signals and the provider re-fetches invoice status before returning a paid event.
- Because the reviewed Blink docs did not expose a documented signature-secret retrieval flow in the API examples, webhook validation is permissive in v1.

## Files Changed

- `layers/lightning/providers/blink.ts`
- `layers/lightning/services/lightning.ts`
- `layers/lightning/types/lightning.ts`
- `layers/lightning/utils/lightning.ts`
- `layers/lightning/server/composables/useLightning.ts`
- `layers/lightning/server/api/lightning/donation.post.ts`
- `layers/lightning/server/api/webhooks/blink.post.ts`
- `layers/lightning/server/plugins/init.ts`
- `layers/lightning/nuxt.config.ts`
- `layers/lightning/tests/blink-provider.spec.ts`

## Verification

Focused verification completed:

```bash
cd layers
bunx vitest --config vitest.config.ts lightning/tests/blink-provider.spec.ts
```

Covered by tests:

- invoice creation with explicit wallet id
- auto-discovery of BTC wallet id
- invoice status mapping
- webhook processing with invoice status re-fetch
- callback endpoint GraphQL management
- registration in `createLightningService`

## Sources Reviewed

- Blink auth docs: `https://dev.blink.sv/api/auth`
- Blink BTC Lightning receive docs: `https://dev.blink.sv/api/btc-ln-receive`
- Blink webhooks docs: `https://dev.blink.sv/api/webhooks`
- Blink public GraphQL reference: `https://dev.blink.sv/public-api-reference.html`

## Operational Note

Blink callback endpoint management can be denied even when invoice creation is allowed. When Blink returns an authorization error for `callbackEndpointAdd`, the layer now logs a warning and continues without auto-created webhooks instead of surfacing a startup error.

## Runtime Config Note

Blink webhook setup must not mutate `runtimeConfig.lightning.providers.blink`. The provider now caches created callback endpoint ids in provider-local state so Nuxt read-only runtime config objects do not throw during startup.

## Observability Note

Blink webhook processing now logs the received event shape, ignored-event reasons, resolved invoice status, route-level processing start, invoice/order update steps, successful completion, and failures. Logs intentionally avoid raw payload dumps and sensitive values.
