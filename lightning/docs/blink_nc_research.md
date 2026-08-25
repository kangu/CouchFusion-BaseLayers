I dug through the current Blink BTCPay plugin source. The non-custodial Spark integration is much more usable than it first appeared.

BTCPay uses the Blink Lightning Address as an LNURL-pay endpoint, creates a normal BOLT11 invoice through it, and then tracks that exact invoice using LUD-21 payment verification. No Blink API key, wallet ID, seed, wallet balance query, or transaction-history access is required.

The flow is essentially:

yourname@blink.sv
│
▼
GET /.well-known/lnurlp/yourname
│
▼
{
callback: "https://lnurl.blink.sv/...",
minSendable: ...,
maxSendable: ...
}
│
│ GET callback?amount=5000000
▼
{
pr: "lnbc50u1...",
verify: "https://lnurl.blink.sv/verify/..."
}
│
▼
customer pays BOLT11
│
▼
Spark wallet receives funds
│
▼
GET verify URL
│
▼
{
settled: true,
preimage: "...",
pr: "..."
}

That last part solves the merchant-checkout problem.

1. Creating the invoice

BTCPay first resolves the Lightning Address and retrieves its LNURL-pay metadata. It reads the callback, minSendable, maxSendable, and optionally commentAllowed. It then requests the invoice by adding the amount in millisatoshis:

GET <callback>?amount=5000000

for a 5,000 sat invoice.

The callback response contains the BOLT11 invoice in:

{
"pr": "lnbc..."
}

The plugin parses the BOLT11 and checks that the invoice amount is exactly the requested amount. It also checks the description hash when one is being used, specifically to guard against a compromised LNURL server returning a different invoice.

It then extracts:

paymentHash
expiresAt
bolt11
verifyUrl

and uses the payment hash as the invoice ID.

2. The important bit: verify

Blink’s LNURL implementation supports LUD-21.

The invoice callback can directly return:

{
"pr": "...",
"verify": "https://lnurl.blink.sv/verify/<paymentHash>"
}

If verify isn’t included, the plugin reconstructs it as:

<callback-origin>/verify/<paymentHash>

So, for Blink, conceptually:

https://lnurl.blink.sv/verify/<paymentHash>

The implementation explicitly warns not to construct this from blink.sv; it derives the origin from the LNURL callback host.

This means you should save the returned verify URL whenever Blink provides it, rather than assuming its hostname.

3. Payment detection

BTCPay calls:

GET https://lnurl.blink.sv/verify/<paymentHash>

The response exposes the settlement state.

The plugin reads:

settled
preimage
pr

and essentially does:

if (response.settled === true) {
invoice.status = 'paid'
}

So there is no need to:

query Spark balance
↓
look for matching transaction
↓
guess which payment belongs to which order

Every merchant invoice gets its own payment hash and therefore its own verification endpoint.

That’s exactly what you’d want for an e-commerce backend.

4. BTCPay even verifies the cryptographic proof

BTCPay doesn’t blindly trust:

{
"settled": true
}

When Blink returns the payment preimage, the plugin calculates:

SHA256(preimage)

and verifies it equals the invoice’s:

paymentHash

Only a valid preimage is retained.

So you could perform the same validation:

sha256(Buffer.from(preimage, 'hex')).toString('hex') === paymentHash

That’s a worthwhile check in your implementation.

5. BTCPay polls every 3 seconds

There is currently no websocket for the non-custodial Spark integration.

The plugin creates a payment listener that polls each pending invoice:

every 3 seconds
│
▼
GET verify/<paymentHash>
│
├── settled false → continue
│
├── settled true  → mark paid
│
└── expired       → stop tracking

The source defines:

poll interval: 3 seconds
max retry backoff: 30 seconds

If verification requests fail, it uses an exponential per-invoice backoff rather than hitting Blink every three seconds indefinitely.

Blink says payment normally becomes visible within a few seconds, although it can take longer because Spark settlement reaches the Blink LNURL service through an SSP webhook.

6. Interesting architecture detail

There are actually two asynchronous systems involved:

Lightning payer
│
▼
Spark / Lightning infrastructure
│
▼
Blink SSP
│ webhook
▼
Blink LNURL server
│
│ exposes LUD-21 state
▼
your server / BTCPay

The BTCPay source specifically comments that:

Spark settlement is delivered to blink-lnurl-server via an SSP webhook

and BTCPay therefore polls Blink’s LNURL server rather than interacting with Spark itself.

That’s useful because it means you don’t need any Spark SDK or Spark node integration at all for receiving.

⸻

What I’d implement in your backend

For your use case, I wouldn’t reproduce the whole BTCPay client. The required provider could be quite small:

interface LightningProvider {
createInvoice(amountSats: number, description?: string): Promise<Invoice>
getInvoice(paymentHash: string): Promise<InvoiceStatus>
}

For Blink Spark:

type BlinkSparkInvoice = {
bolt11: string
paymentHash: string
verifyUrl: string
expiresAt: Date
}

Creation would look roughly like:

const address = 'store@blink.sv'
const metadata =
await fetch(`https://blink.sv/.well-known/lnurlp/store`)
.then(r => r.json())
const amountMsat = sats * 1000
const result =
await fetch(
`${metadata.callback}?amount=${amountMsat}`
).then(r => r.json())
const bolt11 = result.pr
const decoded = decodeBolt11(bolt11)
const invoice = {
bolt11,
paymentHash: decoded.paymentHash,
verifyUrl:
result.verify ??
`${new URL(metadata.callback).origin}/verify/${decoded.paymentHash}`,
expiresAt: decoded.expiresAt
}

That follows essentially the same algorithm as BTCPay.

Then your payment worker does:

const status =
await fetch(invoice.verifyUrl)
.then(r => r.json())
if (status.settled) {
await markOrderPaid(orderId)
}

And preferably:

if (status.preimage) {
assert(
sha256(hexToBytes(status.preimage)) ===
invoice.paymentHash
)
}

You don’t necessarily need constant server-side polling

BTCPay uses a 3-second poll because it has to provide a generic Lightning-node-style listener abstraction.

For a web checkout, I’d probably use a slightly different model:

Browser checkout
│
│ GET /payment/:id
▼
your backend
│
│ verify if necessary
▼
Blink LUD-21

plus a lightweight server poll while an invoice is actively pending.

For example:

0–2 minutes:
poll every 2–3 sec
2–10 minutes:
poll every 10 sec
after checkout abandoned:
poll every 30–60 sec
after invoice expiry:
stop

You could also let requests from the checkout UI trigger verification, while retaining a background worker for reliability.

One thing I’d definitely persist

Don’t only save:

paymentHash

Save:

{
"provider": "blink-spark",
"lightningAddress": "store@blink.sv",
"bolt11": "...",
"paymentHash": "...",
"verifyUrl": "...",
"amountMsat": 5000000,
"expiresAt": "...",
"status": "pending"
}

The BTCPay implementation can reconstruct the verification endpoint from Lightning Address metadata if its in-memory state disappears, but persisting the exact URL is simpler and safer for your application. The plugin has additional recovery logic because BTCPay can recreate its Lightning client and lose the original in-memory invoice object.

The conclusion changes substantially

My concern from the previous answer — that Blink Spark might lack merchant-grade payment-status detection — is resolved.

Blink Spark is currently quite viable as a non-custodial receiving backend.

You get:

Capability	Blink Spark
Non-custodial funds	✅
API key required	❌
Wallet seed on server	❌
Generate unique BOLT11/order	✅
Know exact invoice paid	✅
Cryptographic payment proof	✅ preimage
Webhook directly to your app	❌
Pollable payment status	✅ LUD-21
Lightning Address only config	✅
Need Spark SDK	❌
Need own LN node	❌

Blink’s own current docs explicitly describe the Spark integration as receive-only, with invoice creation and receiving supported, while sending/balance/channel operations aren’t available to BTCPay because it doesn’t have the seed.

For the payment abstraction you’ve been building, I’d actually consider implementing generic LNURL-pay + LUD-21 support rather than a special BlinkSparkProvider. Blink would then just be one compatible Lightning Address provider. That’s architecturally cleaner and potentially lets the same backend work with any other Lightning Address service implementing LUD-21 verification.
