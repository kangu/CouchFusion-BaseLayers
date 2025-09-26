# Database Layer

Shared database utilities layer for Nuxt applications, providing CouchDB functionality accessible to all layers and apps.

## Purpose

This layer provides a centralized, reusable CouchDB client with comprehensive functionality that can be used across multiple layers and applications. It was extracted from the auth layer to create a proper shared foundation.

## Features

### CouchDB Client (`utils/couchdb.ts`)

- **Authentication & Session Management**
  - `authenticate()` - Login with username/password
  - `getSession()` - Get current session info
  - `generateAuthSessionCookie()` - Generate auth cookies

- **Document Operations**
  - `getDocument()` - Get single document
  - `putDocument()` - Create/update document
  - `createUser()` - Create CouchDB user

- **Query Operations**  
  - `getView()` - Query CouchDB views with POST
  - `getAllDocs()` - Query _all_docs endpoint with POST
  - Full parameter support (keys, include_docs, limit, skip, etc.)

- **Database Management**
  - `testDatabaseConnection()` - Test connectivity
  - `initializeDatabase()` - Initialize with design docs
  - `createOrUpdateDesignDocument()` - Manage design docs

## Usage

### In Layers

Add the database layer as a dependency:

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  extends: ['../../layers/database', /* other layers */]
})
```

### Import Functions

```typescript
import { getDocument, getAllDocs, getView } from '#database/utils/couchdb'

// Get all documents with content
const allDocs = await getAllDocs('mydb', {
  include_docs: true,
  limit: 100
})

// Get specific documents by keys
const specificDocs = await getAllDocs('mydb', {
  keys: ['doc1', 'doc2', 'doc3'],
  include_docs: true
})

// Query a view
const viewResult = await getView('mydb', 'design', 'view', {
  key: 'search-value',
  include_docs: true
})
```

## Configuration

Set these environment variables:

- `COUCHDB_URL` - CouchDB server URL (default: http://localhost:5984)
- `COUCHDB_ADMIN_AUTH` - Base64 encoded admin credentials (username:password)

## Layer Architecture

This layer serves as the foundation database layer:

```
apps/
├── bitvocation-demo/     (extends: database, auth, lightning)
└── pacanele-dashboard/   (no database layer needed)

layers/
├── database/             (foundation - CouchDB utilities)
├── auth/                 (depends on database layer)
└── lightning/            (can use database layer if needed)
```

## Type Safety

All functions are fully typed with TypeScript interfaces:

- `CouchDBViewQueryParams` - Query parameters
- `CouchDBViewResponse` - Response format
- `CouchDBDocument` - Document structure
- `CouchDBError` - Error responses

## Migration Notes

This layer was created by extracting CouchDB utilities from the auth layer. Auth-specific design documents remain in the auth layer at `utils/design-documents.ts`.