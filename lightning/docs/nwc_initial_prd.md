CouchFusion Lightning Payments via Nostr Wallet Connect

Status: Draft
Product: CouchFusion
Feature area: Payments
Default provider: Alby Hub through Nostr Wallet Connect
Target release: Initial Lightning Payments module
Primary runtime: Nuxt/Nitro with CouchDB

⸻

1. Overview

CouchFusion will provide a reusable Lightning payment layer based on Nostr Wallet Connect, abbreviated NWC.

The payment layer will allow CouchFusion applications to:

* create Lightning invoices
* associate invoices with application resources such as orders or subscriptions
* detect when invoices are paid
* verify invoice settlement directly with the connected wallet
* persist payment state in CouchDB
* notify frontend applications when payment status changes
* recover from missed notifications or temporary outages
* support additional NWC-compatible wallet providers beyond Alby

Alby Hub will be the default documented and tested wallet backend because it offers an accessible NWC connection flow, permission-controlled app connections, and self-custodial Lightning node management.

The core CouchFusion payment API must remain provider-neutral. Applications should interact with a standard CouchFusion payment interface rather than calling the Alby SDK directly.

⸻

2. Problem statement

CouchFusion applications currently lack a standard method for receiving and verifying Lightning payments.

Individual applications would otherwise need to independently implement:

* NWC connection management
* invoice creation
* payment-status lookup
* payment notifications
* wallet credential storage
* CouchDB payment documents
* order-to-payment relationships
* idempotent payment processing
* missed-event reconciliation
* frontend status polling
* payment expiration handling

This creates duplicated work and increases the likelihood of security, accounting, and fulfilment errors.

CouchFusion should provide a standard Lightning payment module that gives developers a simple API while preserving self-custody and allowing the wallet backend to remain replaceable.

⸻

3. Goals

3.1 Primary goals

The initial release must:

1. Support Lightning invoice creation through NWC.
2. Use Alby Hub as the default supported NWC provider.
3. Keep all wallet credentials on the server.
4. Store invoices and payment state in CouchDB.
5. Detect settled invoices through NWC notifications.
6. verify payment settlement through an explicit invoice lookup.
7. Recover payments missed during restarts or network interruptions.
8. Prevent duplicate fulfilment when the same settlement is processed more than once.
9. Provide simple Nitro APIs and Nuxt composables for applications.
10. Define a provider interface that allows future NWC-compatible providers.

3.2 Secondary goals

The module should:

* support multiple applications or tenants
* support multiple wallet connections
* support receive-only wallet permissions
* expose useful operational health information
* provide structured events for application-specific fulfilment
* make it easy to replace frontend polling with SSE or WebSockets later
* support future outgoing Lightning payments without requiring architectural changes

⸻

4. Non-goals

The initial release will not provide:

* a full Lightning node
* Lightning channel or liquidity management
* on-chain Bitcoin payments
* outgoing Lightning payments
* custodial user balances
* LNbits integration
* Cashu mint functionality
* fiat conversion
* recurring Lightning payments
* hold invoices
* refunds
* multi-part payment orchestration
* point-of-sale inventory management
* accounting or tax reporting
* a complete merchant dashboard

Outgoing payments may be added later through the same provider abstraction, but the first release should use receive-only NWC permissions wherever possible.

⸻

5. Target users

CouchFusion application developer

Needs to add Lightning payments without understanding the full NWC protocol or wallet implementation.

Expected workflow:

1. Enable the CouchFusion payments module.
2. Add an Alby NWC connection string to server configuration.
3. Create a payment for an application resource.
4. Display the returned invoice.
5. react to a confirmed payment event.

Application customer

Needs to:

1. See a Lightning invoice or QR code.
2. Pay it using any compatible Lightning wallet.
3. Receive confirmation shortly after settlement.
4. Avoid duplicate charges or unclear payment states.

Application operator

Needs to:

* know whether the NWC connection is working
* inspect pending, paid, expired, and failed payments
* recover payments after outages
* rotate wallet credentials
* understand which application resource corresponds to each payment

⸻

6. Product principles

Server-owned wallet access

The NWC connection string must never be exposed to browser code.

All wallet operations must execute inside Nitro server routes, server plugins, jobs, or workers.

CouchDB as the application source of truth

The wallet is authoritative for whether a Lightning invoice settled.

CouchDB is authoritative for how the CouchFusion application has processed that settlement.

Frontend applications should normally read payment state from CouchFusion rather than querying the wallet directly.

Notifications are a trigger, not final proof

An NWC payment_received notification should initiate payment processing.

Before changing the payment to paid, CouchFusion must verify the invoice through the provider’s invoice lookup method.

At-least-once event handling

Notifications and reconciliation may process the same payment more than once.

All settlement processing and application fulfilment must therefore be idempotent.

Provider abstraction

CouchFusion must not embed Alby-specific logic into the application-facing API.

Alby should be implemented as the default NWC configuration and documentation path, while the runtime operates against a generic NWC provider adapter.

⸻

7. User stories

Invoice creation

As a developer, I want to create a Lightning invoice for an application resource so that the customer can pay the correct amount.

Payment display

As a customer, I want to receive a BOLT11 invoice and QR-compatible value so that I can pay from a Lightning wallet.

Immediate settlement detection

As an operator, I want the application to react to wallet settlement notifications so that orders can be confirmed quickly.

Settlement verification

As a developer, I want CouchFusion to verify the payment with the wallet before fulfilment so that a forged or malformed event cannot mark an order as paid.

Status checking

As a frontend developer, I want to query a CouchFusion payment endpoint so that I can show pending, paid, or expired states.

Outage recovery

As an operator, I want pending invoices to be reconciled after restarts so that payments made during downtime are not lost.

Credential isolation

As an operator, I want to create a receive-only NWC connection so that a leaked application credential cannot spend wallet funds.

Multiple wallets

As a platform operator, I want separate wallet configurations for different applications or tenants so that payment activity can be isolated.

⸻

8. Functional requirements

8.1 Payment provider interface

CouchFusion must define an internal provider interface similar to:

interface LightningPaymentProvider {
connect(): Promise<void>
close(): Promise<void>
getInfo(): Promise<LightningProviderInfo>
createInvoice(
input: CreateLightningInvoiceInput
): Promise<LightningInvoice>
lookupInvoice(
input: LookupLightningInvoiceInput
): Promise<LightningInvoice>
subscribeToPayments(
handler: LightningPaymentNotificationHandler
): Promise<() => void>
}

The initial adapter will use NWC.

The application-facing payment service must not import or expose provider SDK-specific types.

⸻

8.2 NWC provider configuration

The module must accept server-side configuration such as:

export default defineNuxtConfig({
couchfusion: {
payments: {
provider: 'nwc',
connection: {
env: 'COUCHFUSION_NWC_URL'
}
}
}
})

Environment configuration:

COUCHFUSION_NWC_URL=nostr+walletconnect://...

The NWC connection must be read only by the server runtime.

Configuration should support future named connections:

payments: {
defaultConnection: 'primary',
connections: {
primary: {
provider: 'nwc',
env: 'COUCHFUSION_NWC_PRIMARY_URL'
},
donations: {
provider: 'nwc',
env: 'COUCHFUSION_NWC_DONATIONS_URL'
}
}
}

⸻

8.3 Invoice creation

The payment service must accept:

interface CreatePaymentInput {
amountSats: number
description?: string
referenceType?: string
referenceId?: string
metadata?: Record<string, unknown>
expiresInSeconds?: number
connectionId?: string
}

The service must:

1. Validate the amount.
2. Generate an internal CouchFusion payment ID.
3. Create an invoice through the configured provider.
4. Store the payment document in CouchDB.
5. Return a frontend-safe payment representation.

Example response:

interface PublicLightningPayment {
id: string
status: 'pending' | 'paid' | 'expired' | 'failed'
amountSats: number
invoice: string
paymentHash: string
createdAt: string
expiresAt?: string
referenceType?: string
referenceId?: string
}

The API must not return:

* the NWC connection string
* relay private keys
* provider secrets
* internal error details
* wallet administrative information

⸻

8.4 Trusted amounts

For commerce use cases, the amount should normally be calculated on the server from trusted application data.

The default order-payment workflow must not accept an authoritative price directly from the browser.

Recommended flow:

Browser sends order ID
↓
Server loads order from CouchDB
↓
Server calculates payment amount
↓
CouchFusion creates Lightning invoice

A generic amount-based API may exist for donations or developer-controlled use cases, but it must be explicitly enabled.

⸻

8.5 Payment persistence

Each invoice must create a CouchDB document.

Suggested document:

{
"_id": "lightning-payment:<payment-id>",
"type": "lightning-payment",
"paymentId": "<payment-id>",
"provider": "nwc",
"connectionId": "primary",
"direction": "incoming",
"status": "pending",
"amountSats": 1000,
"amountMsats": 1000000,
"invoice": "lnbc...",
"paymentHash": "...",
"description": "Order 1234",
"referenceType": "order",
"referenceId": "1234",
"metadata": {},
"createdAt": "2026-07-11T10:00:00.000Z",
"updatedAt": "2026-07-11T10:00:00.000Z",
"expiresAt": "2026-07-11T11:00:00.000Z",
"settledAt": null,
"processedAt": null,
"providerState": "pending",
"attempts": {
"lookup": 0,
"processing": 0
}
}

The complete invoice may be hidden from generic public document APIs.

⸻

8.6 Payment statuses

CouchFusion must normalize provider-specific states into:

CouchFusion status	Meaning
creating	Invoice creation is in progress
pending	Invoice exists and is awaiting payment
paid	Settlement was verified
expired	Invoice expired without verified settlement
failed	Invoice creation or processing failed
cancelled	Application cancelled the payment locally
review	Payment requires manual inspection

A payment must not move from paid back to pending, expired, or failed.

An invoice reported as paid after its nominal expiry must still be accepted when the wallet confirms settlement.

⸻

8.7 NWC payment notifications

The server runtime must establish a persistent NWC notification subscription.

For a received payment:

1. Receive the NWC notification.
2. Extract the payment hash.
3. Locate the corresponding CouchDB payment document.
4. Ignore unknown payment hashes or record them for operator review.
5. Call lookupInvoice using the payment hash.
6. Confirm that the invoice is settled.
7. Confirm that the settled amount matches the expected amount.
8. Atomically update the payment document.
9. Emit an internal CouchFusion payment event.
10. Trigger application-specific fulfilment.

A notification alone must never mark a payment as paid.

⸻

8.8 Invoice lookup

The module must provide an internal method:

await payments.refresh(paymentId)

This method must:

* load the payment document
* call the provider’s invoice lookup
* normalize the provider state
* update the CouchDB document when necessary
* process settlement idempotently
* return the current payment

This method will be used by:

* payment notifications
* reconciliation
* administrative tools
* optional explicit status refresh endpoints

⸻

8.9 Reconciliation

The module must periodically reconcile unresolved payments.

Eligible payments include:

* pending invoices that have not expired
* recently expired invoices
* payments whose processing was interrupted
* payments left in creating
* payments marked for manual retry

The reconciliation process must:

1. Query eligible documents from CouchDB.
2. Limit concurrency.
3. Look up each invoice.
4. update its normalized status.
5. process newly settled payments.
6. record lookup attempts and errors.
7. continue processing other payments when one lookup fails.

Suggested defaults:

* active pending invoices: check every 30–60 seconds
* older pending invoices: progressively reduce lookup frequency
* expired invoices: check for a limited grace period
* reconciliation on server startup
* reconciliation after NWC reconnection

Exact intervals should be configurable.

⸻

8.10 Idempotent settlement processing

The payment processor must guarantee that application fulfilment is performed no more than once.

Because CouchDB uses optimistic concurrency, the processor should:

1. Read the latest document revision.
2. Check whether processedAt already exists.
3. Write the verified settlement state.
4. Use revision conflict handling.
5. Emit the fulfilment event only for the successful state transition.
6. Retry conflicts by loading the newest revision.

Suggested settlement fields:

{
"status": "paid",
"providerState": "settled",
"settledAt": "2026-07-11T10:02:15.000Z",
"verifiedAt": "2026-07-11T10:02:16.000Z",
"processedAt": "2026-07-11T10:02:16.000Z"
}

Application fulfilment handlers must also be idempotent.

For example, an order document should not be fulfilled twice merely because the same payment event is delivered repeatedly.

⸻

8.11 Internal payment events

The module should emit structured events:

interface CouchFusionPaymentEvents {
'payment:created': LightningPayment
'payment:paid': LightningPayment
'payment:expired': LightningPayment
'payment:failed': LightningPayment
'payment:review': LightningPayment
}

Applications may register handlers:

couchfusion.hooks.hook('payment:paid', async payment => {
if (payment.referenceType !== 'order') {
return
}
await markOrderPaid(payment.referenceId, payment.id)
})

Event handlers must be documented as potentially retryable and must therefore be idempotent.

⸻

8.12 Server APIs

The module should expose optional Nitro routes.

Create payment

POST /api/couchfusion/payments

Request:

{
"amountSats": 1000,
"description": "Donation",
"referenceType": "donation",
"referenceId": "donation-123"
}

This generic route should be disabled by default unless the application explicitly permits client-supplied amounts.

For commerce, applications should create domain-specific endpoints:

POST /api/orders/:orderId/payment

Get payment

GET /api/couchfusion/payments/:paymentId

Public response:

{
"id": "payment-id",
"status": "pending",
"amountSats": 1000,
"invoice": "lnbc...",
"createdAt": "...",
"expiresAt": "..."
}

Refresh payment

POST /api/couchfusion/payments/:paymentId/refresh

This endpoint should be authenticated, rate-limited, or disabled by default.

The frontend should normally read the CouchDB-backed payment state without causing a provider lookup on every request.

Payment status

GET /api/couchfusion/payments/:paymentId/status

Response:

{
"id": "payment-id",
"status": "paid",
"paid": true,
"settledAt": "..."
}

⸻

8.13 Frontend composable

CouchFusion should provide a Nuxt composable:

const {
payment,
createPayment,
refreshStatus,
startPolling,
stopPolling
} = useLightningPayment()

Example:

const payment = await createPayment({
referenceType: 'order',
referenceId: orderId
})
startPolling(payment.id, {
interval: 2000,
onPaid: async () => {
await navigateTo(`/orders/${orderId}/success`)
}
})

The composable must call CouchFusion APIs only. It must never instantiate an NWC client in the browser.

⸻

8.14 Frontend components

The initial module may provide optional unstyled or minimally styled components:

<CouchFusionLightningInvoice>

Displays:

* amount
* BOLT11 invoice
* QR code
* copy button
* expiration countdown
* payment status
* retry action for expired invoices

<CouchFusionPaymentStatus>

Displays normalized states:

* waiting for payment
* confirming payment
* payment successful
* invoice expired
* payment error

Components should expose slots so applications can apply their own design systems.

⸻

9. Security requirements

9.1 Secret storage

The NWC connection string must:

* exist only in environment variables or an approved secret store
* never be persisted in ordinary CouchDB application documents
* never be returned through Nitro APIs
* never be included in logs
* never be bundled into client-side JavaScript
* be redacted from error reporting

9.2 Minimum wallet permissions

The documented Alby setup should request only:

* invoice creation
* invoice lookup
* received-payment notifications
* transaction reading only when required

The default connection should not permit:

* paying invoices
* keysend payments
* outgoing transfers
* unrestricted administrative actions

9.3 Request validation

The module must validate:

* integer satoshi amounts
* configured minimum and maximum amounts
* description length
* metadata size
* reference identifiers
* requested expiration limits
* connection IDs

9.4 Rate limiting

Invoice creation and explicit refresh endpoints must support rate limiting.

The system should prevent:

* uncontrolled invoice generation
* high-frequency wallet lookups
* oversized metadata submissions
* abuse of public donation endpoints

9.5 Payment verification

Before marking an invoice paid, CouchFusion must verify:

* the provider reports a settled state
* the payment hash matches
* the amount matches the expected amount
* the payment document has not already been processed
* the payment belongs to the expected connection and application context

⸻

10. Reliability requirements

The module must tolerate:

* NWC relay interruptions
* Alby Hub restarts
* CouchFusion application restarts
* temporary wallet unavailability
* duplicate notifications
* notifications arriving out of order
* CouchDB revision conflicts
* invoice payment during application downtime
* invoice payment near or after expiry
* payment handler failure after settlement
* server deployment during an active checkout

A wallet notification may improve response time, but reconciliation must ensure correctness.

⸻

11. Observability

The module should emit structured logs for:

* provider connection established
* provider disconnected
* provider reconnected
* invoice created
* invoice creation failed
* payment notification received
* payment verification started
* payment verified
* payment amount mismatch
* payment processed
* duplicate settlement ignored
* reconciliation started
* reconciliation completed
* CouchDB conflict retried
* unknown payment hash received

Logs must not include NWC secrets.

Suggested metrics:

* total invoices created
* total invoices settled
* total invoices expired
* invoice creation failures
* provider lookup failures
* notification processing latency
* settlement-to-processing latency
* pending invoice count
* reconciliation queue size
* NWC connection status
* CouchDB conflict count
* fulfilment handler failures

⸻

12. Error handling

Invoice creation failure

If the provider cannot create an invoice:

* mark the payment document as failed
* store a safe internal error code
* do not expose provider secrets or raw stack traces
* allow the application to retry by creating a new payment

Provider unavailable

Return a service-unavailable response with a stable error code:

{
"statusCode": 503,
"code": "LIGHTNING_PROVIDER_UNAVAILABLE",
"message": "Lightning payments are temporarily unavailable"
}

Amount mismatch

A settled invoice with an unexpected amount must be marked review.

The referenced order must not be automatically fulfilled.

Unknown settlement

A payment notification that cannot be matched to a CouchFusion payment should be logged and optionally stored in an operational review collection.

Fulfilment failure

If the invoice is verified as paid but the application handler fails:

* keep the payment status as paid
* keep processedAt unset
* store the processing error
* retry fulfilment separately
* never request that the customer pay again

⸻

13. CouchDB views and indexes

The payment database should support efficient queries for:

Payment hash

Find the payment document associated with an NWC notification.

paymentHash → payment document

Reference

Find payments associated with an order or application resource.

referenceType + referenceId

Reconciliation

Find unresolved payments ordered by next reconciliation time.

status + nextCheckAt

Processing retries

Find verified payments whose application processing has not completed.

status = paid + processedAt = null

Connection

Find payments belonging to a specific wallet connection.

connectionId + createdAt

Appropriate Mango indexes or CouchDB views should be created automatically when the module is initialized.

⸻

14. Suggested internal architecture

CouchFusion application
│
├── Nuxt frontend
│   ├── useLightningPayment()
│   ├── invoice component
│   └── status component
│
├── Nitro payment API
│   └── CouchFusion payment service
│
├── Payment service
│   ├── provider registry
│   ├── payment repository
│   ├── settlement verifier
│   ├── payment processor
│   └── reconciliation scheduler
│
├── NWC provider
│   ├── invoice creation
│   ├── invoice lookup
│   ├── notification subscription
│   └── connection lifecycle
│
└── CouchDB
├── payment documents
├── indexes and views
└── processing state
NWC provider
│
▼
Nostr relay
│
▼
Alby Hub
│
▼
Lightning Network

⸻

15. Alby Hub onboarding

The documentation should provide an Alby-first setup flow.

Operator steps

1. Install or open Alby Hub.
2. Ensure the Hub is online and connected to the Lightning Network.
3. Ensure the wallet has sufficient inbound liquidity.
4. Create a new app connection.
5. Name it for the CouchFusion application.
6. Enable invoice creation, invoice lookup, and payment notifications.
7. Disable outgoing payment permissions.
8. Copy the NWC connection string.
9. Store it in COUCHFUSION_NWC_URL.
10. Restart the CouchFusion server.
11. Run the payment connection health check.
12. Create and pay a small test invoice.

The documentation must explain that NWC application connectivity does not itself provide Lightning liquidity.

The connected Alby Hub must remain online and capable of receiving payments.

⸻

16. Health checks

The module should expose an authenticated or internal health check:

GET /api/couchfusion/payments/health

Example:

{
"status": "healthy",
"provider": "nwc",
"connectionId": "primary",
"connected": true,
"notificationsActive": true,
"lastSuccessfulLookupAt": "...",
"lastNotificationAt": "..."
}

The response must not expose:

* wallet balances by default
* wallet identifiers unnecessarily
* Nostr private keys
* relay authentication credentials
* NWC connection URLs

⸻

17. Public API proposal

Server service

const payments = useCouchFusionPayments()
const payment = await payments.create({
amountSats: 1000,
description: 'Order 123',
referenceType: 'order',
referenceId: '123'
})
const current = await payments.get(payment.id)
const refreshed = await payments.refresh(payment.id)
await payments.cancel(payment.id)

Hook registration

couchfusion.hooks.hook('payment:paid', async payment => {
await processPayment(payment)
})

Provider registration

Future custom providers may be registered:

couchfusion.payments.registerProvider(
'custom-nwc',
customProviderFactory
)

⸻

18. Testing requirements

Unit tests

Test:

* amount validation
* status normalization
* expiration calculations
* payment document creation
* payment event serialization
* amount mismatch detection
* duplicate processing prevention
* provider-error normalization
* revision-conflict retry logic

Provider integration tests

Using a mock NWC provider, test:

* invoice creation
* pending invoice lookup
* settled invoice lookup
* expired invoice lookup
* duplicate notifications
* notification before document persistence
* provider disconnection
* provider reconnection
* delayed responses

CouchDB integration tests

Test:

* payment persistence
* payment-hash lookup
* reference lookup
* reconciliation queries
* concurrent settlement updates
* revision conflicts
* processing retry queries

End-to-end tests

Test:

1. Create an order.
2. Generate an invoice.
3. Display the invoice.
4. Simulate settlement.
5. Receive the notification.
6. Verify through lookup.
7. Mark the payment paid.
8. fulfil the order once.
9. show success in the frontend.

Also test settlement while the application is offline, followed by reconciliation after restart.

⸻

19. Acceptance criteria

The initial release is complete when:

1. A CouchFusion application can configure an Alby Hub NWC connection using an environment variable.
2. A server-side API can create a Lightning invoice.
3. The invoice and payment hash are stored in CouchDB.
4. The frontend can display the invoice without access to wallet credentials.
5. The server can receive NWC payment notifications.
6. Every notification-triggered settlement is verified with an invoice lookup.
7. A verified settlement updates the payment to paid.
8. The expected amount is checked before application fulfilment.
9. Duplicate notifications do not cause duplicate fulfilment.
10. Pending invoices are reconciled after a server restart.
11. The frontend can query payment status through a CouchFusion API.
12. Expired invoices are represented correctly.
13. Provider failures return stable, safe error codes.
14. NWC secrets never appear in browser bundles, CouchDB payment documents, or logs.
15. The default documented Alby connection does not require outgoing-payment permissions.
16. Automated tests cover creation, settlement, duplicate events, expiry, outages, and reconciliation.

⸻

20. Delivery phases

Phase 1: Core provider and persistence

* generic provider interface
* NWC adapter
* Alby Hub configuration
* invoice creation
* CouchDB payment documents
* invoice lookup
* normalized payment states

Phase 2: Settlement processing

* notification subscription
* payment-hash lookup
* settlement verification
* idempotent document transition
* CouchFusion payment hooks
* fulfilment retry handling

Phase 3: Recovery and operations

* scheduled reconciliation
* startup reconciliation
* provider health state
* structured logging
* metrics
* operator diagnostics

Phase 4: Developer experience

* Nuxt composable
* optional invoice component
* optional status component
* example checkout application
* Alby Hub setup guide
* testing utilities and mock provider

Future phases

* outgoing Lightning payments
* multiple wallet connections
* tenant-level wallet isolation
* LNURL-pay
* Cashu mint integration
* alternative NWC providers
* SSE payment-status updates
* administrative payment dashboard
* refund workflows

⸻

21. Key product decisions

The initial implementation adopts the following decisions:

* NWC is the primary Lightning wallet protocol.
* Alby Hub is the default documented provider.
* Wallet access is server-side only.
* CouchDB stores application payment state.
* NWC notifications provide immediate settlement signals.
* Invoice lookup provides authoritative verification.
* Reconciliation recovers missed events.
* Application fulfilment is idempotent.
* Frontend clients query CouchFusion rather than the wallet.
* Incoming payments are supported before outgoing payments.
* The CouchFusion API remains provider-neutral.
