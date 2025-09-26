# Strike Webhook Subscription Implementation

## Initial Prompt
In the lightning layer init phase, I want to enable Strike subscriptions if it's the default provider. The request needs to be POST /v1/subscriptions with payload {
  "webhookUrl": env.PUBLIC_SITE_URL +  "/api/webhooks/strike",
  "webhookVersion": "v1",
  "secret": env.STRIKE_WEBHOOK_SECRET,
  "enabled": true,
  "eventTypes": [
    "invoice.created",
    "invoice.updated"
  ]
}
Where do I place the code so it's clean and reacheable from plugins/init?

## Implementation Summary

The Strike webhook subscription system has been successfully implemented with automatic initialization when Strike is configured as the default lightning provider. The implementation follows a clean, modular architecture that separates concerns and maintains reusability.

### Files Modified/Enhanced:

1. **`layers/lightning/providers/strike.ts`** - Extended Strike provider with webhook subscription methods
2. **`layers/lightning/types/lightning.ts`** - Updated LightningProvider type with optional webhook methods  
3. **`layers/lightning/server/plugins/init.ts`** - Added automatic Strike webhook subscription initialization
4. **`layers/lightning/docs/2025-09-02-strike_webhook_subscription_implementation.md`** - This documentation file

### Key Features Implemented:

- **Automatic Initialization**: Webhook subscriptions are automatically set up during server startup when Strike is the default provider
- **Environment Validation**: Comprehensive validation of required environment variables and configuration
- **Graceful Degradation**: Missing configuration results in warnings but doesn't prevent server startup
- **Provider Extension**: Strike provider now includes webhook subscription management methods
- **Clean Architecture**: Webhook logic stays within the Strike provider for better modularity

## Documentation Overview

The Strike webhook subscription system enables automatic setup of webhook endpoints that notify the application when invoice events occur in Strike. This allows for real-time payment status updates and immediate processing of payment completions.

### Architecture Design

#### Provider-Based Approach
The implementation extends the existing Strike provider with webhook subscription capabilities:
- `setupWebhookSubscription(webhookUrl)` - Creates a new webhook subscription
- `listWebhookSubscriptions()` - Lists existing webhook subscriptions  
- `deleteWebhookSubscription(subscriptionId)` - Removes a webhook subscription

#### Initialization Integration
The server initialization plugin automatically sets up webhook subscriptions when:
1. Strike is configured as the default lightning provider
2. Required environment variables are present
3. Strike provider configuration includes webhook secret

### Environment Variables Required

#### Required for Webhook Subscriptions:
- `PUBLIC_SITE_URL` - Base URL for the application (used to construct webhook URL)
- `STRIKE_WEBHOOK_SECRET` - Secret key for webhook signature validation (configured in Strike provider)

#### Strike Provider Configuration:
```typescript
{
  lightning: {
    defaultProvider: 'strike',
    providers: {
      strike: {
        apiKey: 'your-strike-api-key',
        webhookSecret: 'your-webhook-secret',
        baseUrl: 'https://api.strike.me' // optional
      }
    }
  }
}
```

## Implementation Examples

### Webhook Subscription Payload

The system automatically creates webhook subscriptions with this payload structure:

```json
{
  "webhookUrl": "https://yourdomain.com/api/webhooks/strike",
  "webhookVersion": "v1",
  "secret": "your-webhook-secret",
  "enabled": true,
  "eventTypes": [
    "invoice.created",
    "invoice.updated"
  ]
}
```

### Server Startup Flow

1. **Server Initialization**: Nitro plugin runs during server startup
2. **Provider Check**: Verifies if Strike is the default provider
3. **Environment Validation**: Checks for `PUBLIC_SITE_URL` and Strike configuration
4. **Duplicate Prevention**: Checks for existing webhook subscriptions using Strike's GET /v1/subscriptions API
5. **Smart Webhook Setup**: Creates webhook subscription only if none exists for the target URL
6. **Error Handling**: Logs warnings/errors but allows server to continue starting

### Duplicate Prevention System

The implementation now includes intelligent duplicate prevention to avoid creating multiple subscriptions for the same webhook URL:

#### Duplicate Detection Process:
1. **List Existing Subscriptions**: Calls Strike's GET `/v1/subscriptions` API
2. **URL Matching**: Searches for active subscriptions with matching `webhookUrl`
3. **Event Type Validation**: Verifies existing subscription includes required event types (`invoice.created`, `invoice.updated`)
4. **Skip or Create**: Skips creation if valid subscription exists, otherwise creates new one

#### Duplicate Detection Logic:
```typescript
// Check for existing active subscription with same URL
const matchingSubscription = existingSubscriptions.find(sub => 
  sub.webhookUrl === webhookUrl && sub.enabled === true
)

// Verify event types match requirements
const expectedEventTypes = ['invoice.created', 'invoice.updated']
const hasExpectedEvents = expectedEventTypes.every(eventType => 
  matchingSubscription.eventTypes?.includes(eventType)
)
```

### Manual Webhook Management

The Strike provider can also be used programmatically for webhook management:

```typescript
import { createStrikeProvider } from '@/layers/lightning/providers/strike'

// Create provider instance
const strikeProvider = createStrikeProvider({
  apiKey: 'your-api-key',
  webhookSecret: 'your-secret'
})

// Set up webhook subscription
await strikeProvider.setupWebhookSubscription('https://yoursite.com/webhooks/strike')

// List existing subscriptions
const subscriptions = await strikeProvider.listWebhookSubscriptions()

// Delete a subscription
await strikeProvider.deleteWebhookSubscription('subscription-id')
```

### Webhook Event Processing

The existing webhook endpoint (`/api/webhooks/strike`) automatically processes incoming webhooks:

```typescript
// Webhook validates signature using configured secret
const isValid = lightningService.validateWebhook(body, signature, 'strike')

// Process webhook event
const webhookEvent = lightningService.processWebhook(body, 'strike')

// Handle payment completion
if (webhookEvent.status === 'paid') {
  // Business logic for completed payments
}
```

### Error Handling and Logging

#### Initialization Logging:
- `🔔 Initializing Strike webhook subscription...` - Start of webhook setup
- `🎉 Strike webhook subscription initialized successfully` - Successful setup
- `⚠️ PUBLIC_SITE_URL not set, skipping Strike webhook subscription setup` - Missing environment
- `💥 Strike webhook subscription initialization failed:` - Setup error

#### Webhook Operation Logging:
- `📋 Checking for existing Strike webhook subscriptions...` - Start of duplicate check
- `✅ Found existing Strike webhook subscription for URL:` - Existing subscription found
- `📝 Existing subscription ID:` - ID of found subscription
- `✅ Existing subscription has all required event types, skipping creation` - Skip creation message
- `⚠️ Existing subscription missing required event types, will create new one` - Missing events warning
- `🔄 No existing subscription found, creating new one for:` - No duplicates, creating new
- `⚠️ Failed to list existing subscriptions, proceeding with creation:` - List API failure fallback
- `Setting up Strike webhook subscription:` - API request details
- `Strike webhook subscription created:` - Successful subscription creation
- `Failed to setup Strike webhook subscription:` - Setup failure

### Best Practices

1. **Environment Configuration**: Always set `PUBLIC_SITE_URL` to enable webhook subscriptions
2. **Secret Management**: Store webhook secrets securely and never commit them to version control
3. **Testing**: Test webhook endpoints in development before enabling subscriptions
4. **Monitoring**: Monitor server logs for webhook setup success/failure messages
5. **Graceful Handling**: The system continues working even if webhook setup fails

### Troubleshooting

#### Common Issues:

1. **Missing PUBLIC_SITE_URL**: 
   - **Symptom**: Warning message about skipping webhook setup
   - **Solution**: Set `PUBLIC_SITE_URL` environment variable

2. **Invalid Webhook Secret**:
   - **Symptom**: Strike API authentication errors
   - **Solution**: Verify `STRIKE_WEBHOOK_SECRET` matches Strike dashboard configuration

3. **Network Issues**:
   - **Symptom**: Timeout or connection errors during setup
   - **Solution**: Check network connectivity and Strike API status

4. **Duplicate Subscriptions** (Resolved in Current Implementation):
   - **Previous Issue**: Multiple webhook subscriptions created for same URL on server restarts
   - **Current Solution**: Automatic duplicate detection prevents this issue
   - **Manual Cleanup**: If needed, use `listWebhookSubscriptions()` and `deleteWebhookSubscription()` to manage existing duplicates

### Integration Benefits

- **Real-time Updates**: Immediate notification of payment status changes
- **Reduced Polling**: No need to continuously check payment status
- **Improved Performance**: Event-driven architecture reduces API calls
- **Better UX**: Instant payment confirmations and status updates
- **Automatic Setup**: No manual webhook configuration required
- **Duplicate Prevention**: Smart detection prevents multiple subscriptions for the same endpoint
- **Server Restart Safe**: Multiple server restarts won't create duplicate webhook subscriptions
- **Cost Optimization**: Reduces unnecessary webhook traffic and API usage
