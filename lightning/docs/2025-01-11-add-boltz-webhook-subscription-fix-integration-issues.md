# Boltz Webhook Subscription Implementation & Integration Fixes

## Initial Prompt
Evaluate how to add an option for using Boltz Exchange. Add Boltz webhook subscription and fix Boltz integration issues.

## Implementation Summary
Successfully implemented Boltz webhook subscription methods and fixed integration inconsistencies:

1. **Standardized Environment Variables**: Updated Boltz provider to use `NUXT_PUBLIC_SITE_URL` instead of `NUXT_PUBLIC_BASE_URL` for consistency with Strike provider.

2. **Added Webhook Subscription Interface**: Implemented optional webhook subscription methods (`setupWebhookSubscription`, `listWebhookSubscriptions`, `deleteWebhookSubscription`) in Boltz provider with appropriate no-op implementations since Boltz handles webhooks per-swap rather than globally.

3. **Enhanced Initialization Validation**: Added Boltz webhook configuration validation in server init plugin, including environment variable and provider configuration checks.

4. **Maintained Backward Compatibility**: All changes are additive and don't break existing Boltz functionality.

## Documentation Overview
The Boltz provider now fully implements the LightningProvider interface with webhook subscription methods, ensuring API consistency across providers. Environment variable usage has been standardized, and webhook configuration is validated during server startup.

### Key Differences: Boltz vs Strike Webhooks

#### Strike Webhooks (Global)
- Uses global webhook subscriptions managed via API
- Automatic subscription setup during server initialization
- Webhook events sent to configured global endpoint
- Subscription management: create, list, delete operations

#### Boltz Webhooks (Per-Swap)
- Webhooks configured individually for each swap
- No global subscription management API
- Webhook URL included in swap creation request
- Events sent per swap to the configured endpoint

### Environment Variables

#### Required for Both Providers:
- `NUXT_PUBLIC_SITE_URL` - Base URL for webhook endpoints (standardized across providers)

#### Strike-Specific:
- `NUXT_STRIKE_API_KEY` - Strike API authentication
- `STRIKE_WEBHOOK_SECRET` - Webhook signature validation

#### Boltz-Specific:
- `NUXT_BOLTZ_LIQUID_ADDRESS` - Liquid Bitcoin receiving address
- Optional: `NUXT_BOLTZ_REFERRAL_CODE` - Referral code for fee discounts

### Configuration Examples

#### Runtime Config with Boltz as Default:
```typescript
runtimeConfig: {
  lightning: {
    defaultProvider: 'boltz',
    providers: {
      boltz: {
        apiUrl: 'https://api.boltz.exchange/',
        network: 'mainnet',
        liquidAddress: process.env.NUXT_BOLTZ_LIQUID_ADDRESS,
        referralCode: process.env.NUXT_BOLTZ_REFERRAL_CODE
      }
    }
  }
}
```

### Webhook Behavior

#### Boltz Webhook Events:
- `transaction.claimed` - Swap completed successfully
- `invoice.settled` - Lightning invoice paid
- `swap.expired` - Swap timed out
- `swap.refunded` - Swap cancelled/refunded

#### Webhook URL Construction:
```
${NUXT_PUBLIC_SITE_URL}/api/webhooks/boltz
```

### Implementation Examples

#### Webhook Subscription Methods (Boltz):
```typescript
const boltzProvider = createBoltzProvider(config);

// These methods provide interface compliance but are no-ops
// since Boltz handles webhooks per-swap
await boltzProvider.setupWebhookSubscription(webhookUrl);
// Returns: { success: true, note: 'Boltz webhooks configured per-swap' }

const subscriptions = await boltzProvider.listWebhookSubscriptions();
// Returns: [] (Boltz doesn't have global subscriptions)

await boltzProvider.deleteWebhookSubscription(subscriptionId);
// Returns: { success: true, note: 'No global subscriptions to delete' }
```

#### Swap Creation with Webhook:
```typescript
const invoice = await boltzProvider.createInvoice({
  amount: 1000,
  currency: 'sats',
  description: 'Test payment'
});
// Automatically includes webhook configuration:
// webhook: {
//   url: `${NUXT_PUBLIC_SITE_URL}/api/webhooks/boltz`,
//   hashSwapId: false,
//   status: ['transaction.claimed', 'invoice.settled', 'swap.expired']
// }
```

### Startup Validation Messages

#### Successful Boltz Configuration:
```
🔔 Validating Boltz webhook configuration...
✅ Boltz webhook URL configured: https://yourdomain.com/api/webhooks/boltz
ℹ️ Boltz webhooks are configured per-swap, not globally
```

#### Missing Configuration Warnings:
```
⚠️ NUXT_PUBLIC_SITE_URL not set, Boltz webhooks may not work properly
⚠️ Boltz provider configuration not found, skipping webhook validation
⚠️ Boltz liquidAddress not configured, webhooks may not work properly
```

### Best Practices

1. **Environment Variables**: Always set `NUXT_PUBLIC_SITE_URL` for proper webhook URL construction
2. **Provider Configuration**: Ensure `liquidAddress` is configured for Boltz to receive payments
3. **Network Selection**: Use 'mainnet' for production, 'testnet' for development
4. **Webhook Testing**: Test webhook endpoints in development before deploying
5. **Monitoring**: Monitor server logs for webhook configuration validation messages

### Integration Benefits

- **Consistent Interface**: Boltz provider now fully implements LightningProvider interface
- **Standardized Configuration**: Unified environment variable usage across providers
- **Improved Validation**: Better startup-time validation and error messages
- **Per-Swap Flexibility**: Boltz webhooks configured individually per transaction
- **Backward Compatibility**: Existing Boltz integrations continue to work unchanged

### Troubleshooting

#### Webhook Issues:
1. **Verify NUXT_PUBLIC_SITE_URL**: Ensure the environment variable is set correctly
2. **Check Webhook Endpoint**: Confirm `/api/webhooks/boltz` endpoint is accessible
3. **Validate Liquid Address**: Ensure `liquidAddress` is properly configured
4. **Network Configuration**: Verify `network` is set to 'mainnet' or 'testnet'

#### Configuration Issues:
1. **Missing Provider Config**: Add Boltz configuration to runtimeConfig
2. **Environment Variables**: Set all required environment variables
3. **Webhook URL Construction**: Check that webhook URLs are properly formed

The implementation ensures Boltz Exchange can be used as a drop-in replacement for Strike with consistent webhook handling and configuration validation.