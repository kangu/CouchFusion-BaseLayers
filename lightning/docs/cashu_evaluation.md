Yes. You can connect directly to Coinos’ Cashu mint using @cashu/cashu-ts, without Ippon:

CouchFusion
│ cashu-ts
▼
https://mint.coinos.io
│
▼
Coinos Lightning infrastructure

https://mint.coinos.io is a standard Cashu mint endpoint used by Cashu-compatible wallets and applications. Coinos itself includes a Cashu mint as part of its Bitcoin and Lightning infrastructure.

The major implication is that CouchFusion becomes the Cashu wallet. cashu-ts handles the Cashu protocol and cryptography, but it does not provide Ippon’s persistent wallet service, REST abstraction, transaction database, reconciliation worker, or wallet administration.

Direct integration versus Ippon

Responsibility	Ippon	Direct cashu-ts
Request Lightning invoice	Built in	CouchFusion
Detect invoice payment	Built in	CouchFusion
Generate blinded outputs	Built in	cashu-ts
Mint proofs after payment	Built in	CouchFusion calls cashu-ts
Store proofs	Ippon	CouchFusion
Prevent concurrent proof use	Ippon	CouchFusion
Recover interrupted operations	Ippon	CouchFusion
Wallet balance calculation	Ippon	CouchFusion
Outgoing Lightning payments	REST endpoint	CouchFusion orchestrates melt flow
REST API	Built in	Your own internal API
Separate service	Yes	No

cashu-ts describes its wallet classes as mostly stateless and explicitly requires the integrating application to manage state, including storing proofs. It also requires loadMint() or loadMintFromCache() before wallet operations.

Incoming Lightning flow

Receiving through Coinos consists of two distinct financial events:

1. Lightning invoice becomes paid
2. CouchFusion claims Cashu proofs

The standard Cashu minting process is:

1. Request a mint quote.
2. Return the BOLT11 invoice to the customer.
3. Wait for the customer to pay.
4. Check the quote.
5. Generate blinded outputs.
6. Redeem the quote.
7. Store the resulting proofs.

This is defined by NUT-04. A paid invoice does not automatically put proofs into your CouchFusion wallet; your backend must perform the issuance operation.

Conceptually, with the current cashu-ts API:

import { Wallet } from '@cashu/cashu-ts'
const wallet = new Wallet('https://mint.coinos.io', {
unit: 'sat'
})
await wallet.loadMint()
const quote = await wallet.createMintQuote('bolt11', {
amount: 1_000
})
console.log(quote.request) // BOLT11 invoice
console.log(quote.quote)   // Secret quote reference

After payment:

const status = await wallet.checkMintQuote(
'bolt11',
quote.quote
)
if (status.state === 'PAID') {
const proofs = await wallet.mintProofs(
1_000,
quote.quote
)
await proofRepository.add(proofs)
}

The exact convenience-method signatures should be pinned to the specific cashu-ts release you install. Its v5 API supports method-aware quote creation and requires the mint to advertise support for that payment method. cashu-ts is ESM-only from v4 onward.

What CouchFusion must persist

At minimum, your CouchDB design needs four categories of records.

1. Mint configuration

interface CashuMintDocument {
_id: `cashu-mint:${string}`
type: 'cashu-mint'
url: string
unit: 'sat'
enabled: boolean
mintInfoCache?: unknown
keychainCache?: unknown
createdAt: string
updatedAt: string
}

Persisting the mint-info and keychain caches avoids repeated initialization calls, although CouchFusion should still refresh them periodically. cashu-ts exposes both caches after loading a mint.

2. Mint quote

interface CashuMintQuoteDocument {
_id: `cashu-mint-quote:${string}`
type: 'cashu-mint-quote'
mintUrl: string
quoteId: string
paymentId: string
amountSat: number
paymentRequest: string
state:
| 'unpaid'
| 'paid-unclaimed'
| 'claiming'
| 'claimed'
| 'expired'
| 'failed'
amountPaidSat?: number
amountIssuedSat?: number
expiresAt?: string
nextCheckAt?: string
attempts: number
createdAt: string
updatedAt: string
}

Do not expose quoteId to the browser. Under NUT-04, someone who obtains an unprotected quote ID may be able to redeem its ecash. NUT-20 allows a quote to be locked to a wallet-generated public key, but it is optional and must be supported by both the mint and client flow.

3. Proofs

interface CashuProofDocument {
_id: `cashu-proof:${string}`
type: 'cashu-proof'
walletId: string
mintUrl: string
keysetId: string
amountSat: number
secretCiphertext: string
signature: string
dleq?: {
e: string
s: string
r?: string
}
state:
| 'available'
| 'reserved'
| 'pending'
| 'spent'
| 'invalid'
operationId?: string
reservedAt?: string
createdAt: string
updatedAt: string
}

The secret is bearer-value material. Anyone obtaining a valid proof can spend it, so proof records must be encrypted at rest and excluded from logs, API responses and ordinary CouchDB replication.

4. Wallet operation journal

interface CashuOperationDocument {
_id: `cashu-operation:${string}`
type: 'cashu-operation'
walletId: string
mintUrl: string
kind:
| 'mint'
| 'swap'
| 'melt'
| 'send'
| 'receive'
| 'restore'
state:
| 'preparing'
| 'submitted'
| 'pending'
| 'completed'
| 'reconciling'
| 'failed'
inputProofIds: string[]
outputProofIds: string[]
quoteId?: string
paymentId?: string
createdAt: string
updatedAt: string
}

This journal is essential because CouchDB does not provide multi-document transactions.

The hardest implication: proof concurrency

Proofs are bearer instruments and can only be spent once.

Suppose two CouchFusion processes both observe:

Proof A: 512 sats, available
Proof B: 256 sats, available

Both workers could select the same proofs for different outgoing payments. One succeeds; the other fails or enters an ambiguous state.

You therefore need a strict reservation procedure:

available
↓ atomic _rev update
reserved
↓ submit to mint
pending
↓ confirmed
spent

Use CouchDB revisions as compare-and-swap locks:

async function reserveProof(
proof: CashuProofDocument,
operationId: string
) {
if (proof.state !== 'available') {
throw new Error('Proof is not available')
}
return db.put({
...proof,
state: 'reserved',
operationId,
reservedAt: new Date().toISOString()
})
}

If another process updates the proof first, CouchDB returns a conflict. The entire selected proof set must then be released or retried.

For a first implementation, I strongly recommend that all Cashu wallet mutations pass through one logical worker queue, even when CouchFusion runs multiple Nitro instances:

Nitro API instances
│
▼
Cashu operation queue
│
▼
Single wallet executor
│
▼
Coinos mint

Invoice creation and status reads can be distributed. Proof minting, swaps, melts and sends should be serialized per wallet.

Deterministic secrets and recovery

Randomly generated proof secrets are simple, but database loss means fund loss. A deterministic wallet seed lets you reproduce output secrets and attempt recovery from the mint.

For CouchFusion, store:

* an encrypted wallet seed;
* deterministic output counters;
* NUT-20 quote-locking counters, when used;
* operation reservations before submission;
* mint keyset metadata;
* proofs and their states.

cashu-ts includes support for deterministic counters and seed-derived keys, but your application must persist counters at the correct time. Its documentation distinguishes operation-local counter reservation hooks from global wallet events.

The safe sequence is:

1. Reserve deterministic counter range
2. Persist reservation
3. Generate outputs
4. Submit mint operation
5. Persist returned proofs
6. Complete reservation

Never generate recoverable outputs and only afterward persist the counters. A crash between those steps can cause secret reuse.

Settlement state machine

Do not map Cashu payment status directly to only pending or paid.

Use:

invoice_pending
│
▼
invoice_paid
│
▼
proofs_claiming
│
▼
settled

Suggested CouchFusion states:

type PaymentState =
| 'invoice_pending'
| 'invoice_expired'
| 'invoice_paid_unclaimed'
| 'claiming'
| 'settled'
| 'reconciliation_required'
| 'failed'

For commerce, the question is when to mark the order paid.

Conservative policy

Mark it paid only after the Cashu proofs have been successfully issued and persisted:

Lightning paid + proofs stored = order settled

This avoids marking an order paid while CouchFusion has failed to collect the corresponding ecash.

Faster policy

Mark it paid as soon as Coinos reports the Lightning quote paid, then claim proofs asynchronously.

That offers lower checkout latency but creates a receivable state where:

customer has paid
CouchFusion has not yet acquired proofs

I recommend the conservative policy initially.

Polling and WebSockets

Cashu supports optional NUT-17 WebSocket subscriptions at /v1/ws, including mint-quote state notifications. You should inspect Coinos’ /v1/info response at runtime rather than hard-code assumed NUT support.

Implement both:

Preferred: NUT-17 subscription
Fallback: GET quote status polling

Even with WebSockets, retain reconciliation polling because:

* the WebSocket may disconnect;
* the process may restart;
* a notification may arrive before local persistence;
* optional NUT support can change.

Suggested schedule:

First minute: every 3 seconds
Minutes 1–5: every 10 seconds
After 5 minutes: every 30–60 seconds
After expiry: one final reconciliation

Outgoing Lightning payments

If CouchFusion later needs to pay invoices, it must implement the full melt flow:

1. Request a melt quote.
2. Determine invoice amount and fee reserve.
3. Select enough proofs.
4. Swap proofs when exact denominations are unavailable.
5. Reserve selected proofs.
6. Submit them to the mint.
7. Handle pending payment state.
8. Receive fee change proofs.
9. Persist change.
10. Mark inputs spent.

NUT-05 defines the melt quote and payment flow. NUT-08 defines how unused fee reserves may be returned as newly signed change proofs.

With cashu-ts, the conceptual flow is:

const quote = await wallet.createMeltQuote(
'bolt11',
{
request: invoice
}
)
const required = quote.amount + quote.fee_reserve
const { keep, send } = await wallet.send(
required,
availableProofs
)
const result = await wallet.meltProofs(
quote,
send
)

The integration must atomically reconcile:

* send proofs as spent or pending;
* keep proofs as still available;
* any fee-return change proofs from the mint.

The project’s migration guide specifically notes that callers are responsible for orchestrating melt quotes, proof selection and meltProofs; there is no single high-level payLnInvoice helper.

Security implications

Coinos remains custodian

Although CouchFusion holds the ecash proofs, the underlying bitcoin remains with the Coinos mint. Coinos must remain willing and able to redeem the proofs over Lightning. Cashu is explicitly a bearer-token system backed by the selected mint.

CouchFusion becomes custodian of proofs

Within your application, Cashu proofs behave like digital banknotes. A database read vulnerability can become direct financial theft.

At minimum:

* encrypt proof secrets using an application-level master key;
* keep encryption keys outside CouchDB;
* never expose CouchDB publicly;
* prohibit arbitrary mint URLs;
* redact quotes, proofs and seeds from logs;
* use a dedicated wallet per installation or tenant;
* set a low maximum retained balance;
* sweep funds to a treasury wallet;
* separate staging and production seeds;
* audit every proof-state transition.

SSRF risk

Because cashu-ts talks to mint URLs, never accept a mint URL from an untrusted request and instantiate a wallet with it. The official documentation explicitly recommends a trusted-mint allowlist for server-side usage.

Proposed CouchFusion structure

server/
payments/
core/
payment-provider.ts
payment-service.ts
payment-state-machine.ts
providers/
cashu/
cashu-provider.ts
cashu-wallet.ts
cashu-repository.ts
cashu-operation-runner.ts
cashu-reconciler.ts
cashu-crypto-storage.ts
api/
payments/
lightning/
invoice.post.ts
[paymentId].get.ts
tasks/
cashu-settlement-worker.ts
cashu-reconciliation-worker.ts
cashu-sweep-worker.ts

Keep the public interface provider-neutral:

interface LightningPaymentProvider {
createInvoice(input: {
amountMsat: number
description?: string
externalId: string
}): Promise<{
providerReference: string
paymentRequest: string
expiresAt?: string
}>
reconcileInvoice(
providerReference: string
): Promise<{
state:
| 'pending'
| 'paid_unclaimed'
| 'settled'
| 'expired'
| 'failed'
}>
}

The Cashu implementation may internally return settled only after proofs are securely persisted.

Recommended implementation phases

Phase 1: receive-only bridge

Build only:

* one Coinos mint;
* one sat-denominated wallet;
* invoice creation;
* quote polling;
* proof minting;
* encrypted proof storage;
* balance calculation;
* idempotent settlement;
* restart reconciliation.

Do not initially implement:

* outgoing payments;
* Cashu token imports;
* Cashu token exports;
* multiple mints;
* tenant-controlled mints;
* automated proof swaps.

This sharply reduces risk because newly minted proofs naturally arrive in mint-supported denominations.

Phase 2: wallet resilience

Add:

* deterministic seed and counters;
* restore testing;
* NUT-20 quote locking when Coinos advertises it;
* NUT-17 subscriptions when available;
* periodic proof-state checks;
* stale reservation recovery;
* operational metrics and alerts.

Phase 3: treasury sweeping

Add outgoing Lightning melts and sweep to an Alby Hub, Zeus or other treasury wallet.

This is where proof-selection concurrency and pending melt recovery become critical.

Phase 4: multi-tenant support

Use one logical Cashu wallet per tenant:

tenant ID
wallet seed
proof namespace
operation queue
balance
sweep destination

Do not pool all tenants’ proofs unless CouchFusion intentionally operates an internal custodial ledger.

Direct cashu-ts or Ippon?

For CouchFusion, direct integration is a good choice when:

* you want a single deployable application;
* you want full control over proof persistence;
* Cashu is a core platform capability;
* you are prepared to implement wallet-grade recovery;
* you want no external wallet service dependency.

Ippon is preferable when:

* you want the fastest implementation;
* you prefer a conventional REST boundary;
* you want wallet concerns isolated in another service;
* you do not want CouchFusion’s database to contain bearer proofs;
* you want to swap wallet implementations independently.

My recommendation is:

Use direct cashu-ts for the receive-only CouchFusion prototype, but treat it as a real wallet subsystem—not merely another HTTP payment provider.

The initial bridge is reasonably compact. The difficult engineering begins when adding outgoing payments, concurrent workers, recovery, multi-tenancy and treasury management. Pin the cashu-ts version, use Coinos only through an operator-configured allowlist, and make “proofs successfully persisted” the settlement boundary.
