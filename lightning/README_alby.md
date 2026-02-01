# Alby Lightning Provider (PAT) – Setup & Usage

## Prerequisites
- Alby account with **Personal Access Token (PAT)** that has `invoices:create` and `invoices:read` scopes.
- Server URL accessible by Alby for webhooks (e.g., `NUXT_PUBLIC_SITE_URL`).

## Configuration (runtimeConfig example)
```ts
// nuxt.config.ts (runtimeConfig)
export default defineNuxtConfig({
  runtimeConfig: {
    lightning: {
      defaultProvider: 'alby',
      providers: {
        alby: {
          accessToken: process.env.ALBY_PAT,
          apiUrl: 'https://api.getalby.com',
          webhookUrl: `${process.env.NUXT_PUBLIC_SITE_URL}/api/webhooks/alby`
        }
      }
    }
  }
})
```

Required env:
- `ALBY_PAT`: Personal Access Token
- `NUXT_PUBLIC_SITE_URL`: public base URL (for webhooks)

## What the provider does
- Create invoice: POST `/invoices` (sats, memo -> description)
- Check status: GET `/invoices/{payment_hash}`
- Webhooks: auto-create endpoint at Alby if `webhookUrl` provided; listens for `invoice.incoming.settled`.

## Using via API (donation endpoint)
```http
POST /api/lightning/donation
{ "amount": 5000, "memo": "Test", "provider": "alby" }
```
Response includes `paymentRequest`, `id` (payment_hash), status.

## Webhook handler
- Exposed at `/api/webhooks/alby`
- Validates `svix-signature` using the secret returned when the endpoint is created.

## Notes
- PAT is server-only; never expose to client.
- If webhooks cannot be created (no public URL), polling via `/api/lightning/status/:id` still works.
- Alby expiry is derived from `expires_at`; we map to `expired` when current time passes it.
