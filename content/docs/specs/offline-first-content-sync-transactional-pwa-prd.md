# PRD: Offline-First Content Sync and Transactional PWA Runtime

## Status

Draft for architecture and product validation.

## Summary

Implement an offline-first runtime for CouchFusion/Nuxt apps where the browser runs local PouchDB databases that replicate with CouchDB-backed central services. The system must support content-managed pages, user-owned documents, and full transactional workflows by storing local transaction intents first, then syncing them to the backend for validation and confirmation.

The core user-facing contract is:

> A submitted transaction is "Submitted, awaiting confirmation" until the backend validates and commits it.

This avoids false success states while still allowing users to work, browse, submit, and continue in offline or forced-local mode.

## Intended Audience

Primary audience:

- Developers evaluating CouchFusion as a stack for Nuxt applications.

Target app categories:

- Content-managed marketing sites.
- Offline/local-first workflow apps.
- Marketplaces and order-taking apps.

Comparison alternatives:

- WordPress/headless CMS sprawl.
- Firebase/Supabase lock-in.
- Fragile custom sync/offline plumbing.

## Product Positioning

The homepage-level claim this feature should eventually support:

> Build Nuxt apps with CouchDB-backed content and local-first data.

More precise developer-facing claim:

> Build Nuxt apps where content, user data, and transaction intents live locally first, then replicate to CouchDB for backend confirmation.

The system must not claim that offline transactions are globally confirmed before the backend accepts them.

## Problem

Current content-driven Nuxt apps assume a live runtime path for content and server APIs. This creates weak behavior when:

- The network is unavailable.
- The user explicitly enables offline mode even while a network exists.
- Content pages need to remain available from local storage.
- User-owned work should continue locally and sync later.
- Transactional actions need to be captured reliably without pretending they are confirmed.

Developers need an integrated frontend/backend pattern that avoids one-off service worker hacks, custom sync loops, and unclear transaction states.

## Goals

1. Replicate required content page documents to local PouchDB.
2. Replicate user-owned documents bidirectionally between local PouchDB and a central user-owned endpoint.
3. Make locally replicated content available to the app and service worker.
4. Allow app-level forced offline mode where local content is served even when the network is available.
5. Support full transactional workflows through local transaction intents and backend confirmation.
6. Keep transaction state honest with "Submitted, awaiting confirmation" before backend commit.
7. Provide deterministic indexing and manifests so local route/content lookup is fast.
8. Keep backend authority for identity, permissions, validation, publication state, and canonical transaction results.

## Non-Goals

- Do not make every CouchDB document globally available to every browser.
- Do not let clients directly write canonical confirmed orders, payments, or inventory mutations.
- Do not require service workers to render Nuxt pages themselves.
- Do not promise conflict-free offline transactions.
- Do not implement Lightning/payment confirmation as part of the first offline-first scope.
- Do not treat offline/local-first as a content-only problem; user data and transactions need separate replication semantics.

## Core Concepts

### Local Browser Databases

Each app should maintain separate PouchDB databases for separate trust and replication boundaries.

Recommended minimum:

```text
content_local
  Pull-only or editor-gated replicated content documents.

user_local
  Bidirectional user-owned documents.

transaction_outbox
  Local transaction intent queue.

transaction_results
  Backend-written transaction confirmations/rejections replicated down.

local_projections
  Derived local UI state for fast rendering and clear pending status.
```

The databases may be implemented as separate PouchDB instances or one local database with strict document type boundaries. Separate databases are easier to reason about.

### Central Replication Endpoints

The frontend should replicate with two required central endpoint categories:

```text
User-owned endpoint
  Bidirectional sync for authenticated user documents and transaction intents.

Content endpoint
  Pull sync for required content pages, route manifests, content settings, and asset manifests.
```

The content endpoint must be a policy surface, not just raw unrestricted access to the central content database.

### Forced Offline Mode

Forced offline mode means:

- The app chooses local content and local state even if `navigator.onLine` is true.
- The service worker intercepts eligible content/runtime requests and serves from local IndexedDB/PouchDB-backed data.
- User actions continue to write local documents and transaction intents.
- Replication may be paused or allowed depending on app settings, but reads remain local-first.

This is distinct from network failure.

## User Experience Requirements

### Transaction State Ladder

Transactional flows must expose these states clearly:

```text
Draft
Saved locally
Submitted, awaiting confirmation
Confirmed
Needs attention
Rejected
```

Recommended meanings:

- `Draft`: local form or cart is not submitted.
- `Saved locally`: data is durable in local PouchDB but not queued as a transaction.
- `Submitted, awaiting confirmation`: transaction intent exists locally and is queued/synced for backend validation.
- `Confirmed`: backend wrote a canonical accepted result.
- `Needs attention`: backend needs user action, for example changed price or missing data.
- `Rejected`: backend rejected the intent.

### Language Rules

The UI must not say:

- "Order confirmed" before server acceptance.
- "Payment complete" based only on local state.
- "Synced" when only local persistence happened.

The UI may say:

- "Saved locally."
- "Submitted, awaiting confirmation."
- "Will sync when connected."
- "Confirmed by server."
- "Needs attention before confirmation."

## Functional Requirements

### FR1: Content Local Replication

The content layer must provide a syncable representation of required content.

Required document categories:

- Published page documents needed by the app.
- Route manifest.
- Navigation manifest, if separate from pages.
- Component registry version metadata, if needed by runtime.
- Runtime theme/font settings.
- Asset manifest for required images/files.
- Tombstone/depublication markers for documents that should be removed locally.

Content docs must include enough metadata for local selection:

- `_id`
- `type`
- `path`
- `locale`
- `revision` or source `_rev`
- `updatedAt`
- `published`
- `collection` or `scope`
- optional `requiredForOffline`

### FR2: Local Content Indexes

The local content database must create indexes for:

- `type`
- `path`
- `locale`
- `published`
- `updatedAt`
- `requiredForOffline`
- `collection` or `scope`

Route resolution should prefer a manifest lookup over broad queries.

Example route manifest:

```json
{
  "_id": "manifest:routes:en",
  "type": "content_route_manifest",
  "locale": "en",
  "updatedAt": "2026-07-06T00:00:00.000Z",
  "routes": [
    {
      "path": "/",
      "pageId": "page-/index",
      "revision": "3-abc"
    }
  ]
}
```

### FR3: Service Worker Local Serving

The service worker must support:

- App shell caching.
- Static asset caching.
- Local content API response serving.
- Forced offline mode.
- Network failure fallback.

The service worker should not render Vue/Nuxt itself. It should provide cached app shell assets and local data responses so the Nuxt app can hydrate from local PouchDB.

Required behavior:

```text
If forced offline mode is enabled:
  Serve eligible content/runtime reads from local data.

Else if network is available:
  Prefer normal network/runtime behavior, with local fallback for eligible content.

Else:
  Serve eligible content/runtime reads from local data.
```

### FR4: User-Owned Document Sync

The browser must maintain bidirectional replication for authenticated user-owned documents.

Examples:

- Preferences.
- Drafts.
- Cart state.
- Local workspace documents.
- Form drafts.
- Saved views.

Security requirement:

- Users must only replicate documents they are allowed to read/write.

Preferred backend model:

- Per-user database for private user documents, or
- Strict filtered replication with server-side validation.

Per-user databases are preferred for the first implementation because they reduce authorization ambiguity.

### FR5: Transaction Intent Outbox

Transactional actions must create local intent documents rather than directly writing canonical confirmed state.

Example:

```json
{
  "_id": "intent:01hx-example",
  "type": "transaction_intent",
  "intentType": "create_order",
  "status": "submitted_awaiting_confirmation",
  "createdAt": "2026-07-06T00:00:00.000Z",
  "clientId": "client:device-123",
  "userId": "user:123",
  "idempotencyKey": "order-submit-01hx-example",
  "basedOn": {
    "catalogVersion": "catalog:2026-07-06",
    "contentRevision": "12-abc"
  },
  "payload": {
    "items": [],
    "deliveryAddress": {}
  }
}
```

The UI should update local projections immediately to show "Submitted, awaiting confirmation."

### FR6: Backend Transaction Processor

The backend must consume transaction intents and produce canonical results.

Processor responsibilities:

1. Authenticate/authorize the user.
2. Validate schema.
3. Validate business rules.
4. Check idempotency key.
5. Compare submitted content/catalog version against current backend truth.
6. Commit canonical mutation if valid.
7. Write a transaction result document.
8. Mark the intent processed or leave it as an immutable audit document.

Example result:

```json
{
  "_id": "transaction-result:intent:01hx-example",
  "type": "transaction_result",
  "intentId": "intent:01hx-example",
  "status": "accepted",
  "canonicalDocId": "order:1001",
  "serverCommittedAt": "2026-07-06T00:01:00.000Z",
  "message": "Order confirmed."
}
```

### FR7: Transaction Rejection and Attention States

The backend must support non-accepted outcomes.

Examples:

- `rejected_invalid_schema`
- `rejected_unauthorized`
- `rejected_stock_unavailable`
- `needs_attention_price_changed`
- `needs_attention_catalog_changed`
- `needs_attention_payment_required`

The frontend must render these as actionable states, not silent sync failures.

### FR8: Replication Observability

The frontend must expose sync status:

- Content sync status.
- User document sync status.
- Transaction outbox status.
- Last successful sync time.
- Pending intent count.
- Failed/needs-attention count.

The backend must expose logs or status documents for transaction processing.

## Backend Architecture

Recommended backend components:

```text
CouchDB content database
  Authoritative content pages and settings.

Content sync policy endpoint
  Exposes only syncable required content documents.

User-owned database endpoint
  Per-user or filtered database replication.

Transaction intent endpoint/database
  Receives replicated client intents.

Transaction processor
  Validates intents and writes canonical results.

Canonical transactional databases
  Orders, inventory reservations, submissions, etc.

Transaction result replication endpoint
  Sends accepted/rejected/needs-attention results back to clients.
```

The transaction processor may be implemented as:

- A Nitro server worker/plugin that watches CouchDB changes.
- A dedicated worker service.
- A queue consumer if the platform introduces a queue layer.

It must be idempotent.

## Frontend Architecture

Recommended frontend modules:

```text
useOfflineMode()
  Reads/writes forced offline mode state.

useLocalContent()
  Reads content documents from local PouchDB and route manifests.

useContentReplication()
  Starts/stops content pull replication.

useUserReplication()
  Starts/stops user-owned bidirectional replication.

useTransactionOutbox()
  Creates transaction intents and tracks local queue state.

useTransactionResults()
  Applies backend result documents to local projections.

service-worker runtime
  Serves app shell and local content responses in offline/forced-local mode.
```

## Content Layer Responsibilities

This belongs primarily in the content layer because the content layer owns:

- Content page documents.
- Runtime page rendering.
- Content route resolution.
- Content i18n metadata.
- Content settings such as fonts/theme.
- CouchDB-backed content APIs.

The content layer should provide the local content sync primitives and service worker content-response contract.

The content layer should not own every domain-specific transaction. Instead, it should define a reusable transaction intent/result pattern that consuming apps or other layers can extend.

## Data Ownership Rules

### Content Documents

- Backend content database is authoritative.
- Browser content database is a replicated cache.
- Editors may need separate authenticated edit sync in future phases.

### User Documents

- User owns local-first documents.
- Backend may validate schemas and permissions.
- Conflicts must be visible where automatic merge is unsafe.

### Transaction Documents

- Client owns intent creation.
- Backend owns canonical result.
- Client must not create confirmed canonical transaction docs directly.

## Conflict Rules

Content:

- Pull-only for public users.
- Server wins.
- Tombstones/depublication markers remove local availability.

User documents:

- Simple docs may use last-write-wins if product-approved.
- Important docs require merge UI or append-only events.

Transactions:

- No direct conflict on canonical docs.
- Duplicate intents are handled by idempotency keys.
- Backend result is authoritative.

## Security and Privacy Requirements

- Do not replicate unpublished/private content to unauthenticated clients.
- Do not store secrets in local PouchDB.
- Treat local browser databases as user-accessible storage.
- Encrypting local data may be considered for sensitive use cases but should not be framed as a replacement for access control.
- Service worker must not serve stale privileged content after logout.
- Logout must clear or lock user-owned local databases.
- Content sync endpoints must enforce publication and permission rules server-side.

## Acceptance Criteria

### Content Offline Runtime

- Required published pages replicate to local PouchDB.
- Route manifest resolves a synced page by path and locale.
- Forced offline mode serves synced content even when network is available.
- Network offline mode serves synced content without a network request.
- Unpublished/deleted content is removed or tombstoned locally after sync.

### User Sync

- Authenticated user-owned docs replicate bidirectionally.
- Logging out stops replication and clears or locks private local data.
- Conflicts are visible for document types that cannot safely auto-merge.

### Transactions

- A transactional action creates a local intent document.
- UI immediately shows "Submitted, awaiting confirmation."
- Backend accepts a valid intent and writes a result.
- Frontend receives the result and updates to "Confirmed."
- Backend rejects or flags invalid intents and frontend shows actionable feedback.
- Re-submitting the same intent does not duplicate canonical records.

### Service Worker

- Service worker can serve app shell offline.
- Service worker can serve local content data responses in forced offline mode.
- Service worker does not bypass authentication or expose private content.

## Implementation Phases

### Phase 1: Local Content Runtime

- Define syncable content document shapes.
- Add route/content manifests.
- Add local PouchDB content store.
- Add local content query APIs/composables.
- Add service worker local content response path.
- Support forced offline mode for content reads.

### Phase 2: User-Owned Document Sync

- Add authenticated user-local database bootstrap.
- Add bidirectional replication lifecycle.
- Add logout cleanup/lock behavior.
- Add sync status UI primitives.

### Phase 3: Transaction Intent Pattern

- Add transaction intent schema.
- Add local outbox composable.
- Add result schema.
- Add backend idempotent processor interface.
- Add "Submitted, awaiting confirmation" projection behavior.

### Phase 4: Domain Integration

- Integrate with one concrete domain, preferably orders/marketplace.
- Include catalog/content revision in transaction intents.
- Implement accepted/rejected/needs-attention outcomes.

### Phase 5: Hardening

- Add conflict UI patterns.
- Add service worker cache invalidation.
- Add migration/versioning for local DB schemas.
- Add observability and debugging tools.
- Add end-to-end offline tests.

## Open Questions

1. Should content sync use raw CouchDB replication, a filtered CouchDB endpoint, or a generated offline bundle plus delta sync?
2. Should each authenticated user get a dedicated CouchDB database?
3. How should local PouchDB databases be named across multiple apps/sites on the same domain?
4. What is the first domain transaction to implement: order submission, form submission, booking request, or editor content draft?
5. What data must be wiped on logout versus retained as anonymous offline content?
6. Should forced offline mode pause replication or only force local reads?
7. How should i18n route manifests be represented locally?
8. How should local schema migrations be versioned and tested?

## Risks

- Service worker and app state can diverge if offline mode is not centralized.
- Raw content replication can leak unpublished or private documents.
- Transaction UX can mislead users if copy says "confirmed" too early.
- PouchDB indexes and large content payloads can create storage/performance problems.
- Multi-tab replication can create duplicate workers or noisy conflicts.
- Local data cleanup on logout is easy to get wrong.
- Backend transaction processors must be idempotent or duplicate submissions can create real business issues.

## Success Metrics

- A developer can install and inspect a demo showing content available offline.
- A route can load from local content while forced offline mode is enabled and network is still available.
- A transactional demo can submit locally, show "Submitted, awaiting confirmation," then update to "Confirmed" after backend processing.
- No private/unpublished content is present in local unauthenticated storage.
- Replayed transaction intents do not create duplicate canonical records.

