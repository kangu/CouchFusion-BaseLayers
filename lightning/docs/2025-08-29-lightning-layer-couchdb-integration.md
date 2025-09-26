# Lightning Layer CouchDB Integration

## Initial Prompt

Implement inside the lightning layer a similar functionality like the one in "auth", with server/plugins/init.ts and a utils/design-documents file for documents that need to be pushed.

The init plugin should work with a database named "${runtimeConfig.dbLoginPrefix}-orders"

## Implementation Summary

Successfully implemented CouchDB integration for the lightning layer following the auth layer pattern:

**Files Created:**

1. **`layers/lightning/utils/design-documents.ts`** - Comprehensive CouchDB design document with 11 different views:
   - Basic queries: `by_invoice_id`, `by_status`, `by_provider`, `by_timestamp`
   - Compound queries: `by_status_and_timestamp`, `by_provider_and_status`
   - Specialized queries: `by_amount`, `by_expiration`, `by_swap_id` (for Boltz)
   - Statistics views: `stats_by_status`, `stats_by_provider` (with reduce functions)

2. **`layers/lightning/server/plugins/init.ts`** - Server initialization plugin that:
   - Runs on server startup
   - Uses `${runtimeConfig.dbLoginPrefix}-orders` database name (e.g., "bv-orders")
   - Initializes database with lightning design documents
   - Handles errors gracefully without crashing server startup

**Cross-Layer Import Configuration:**

3. **`layers/database/nuxt.config.ts`** - Fixed alias configuration:
   - Added proper `fileURLToPath` import
   - Enabled `#database` alias pointing to database layer root

4. **`layers/lightning/nuxt.config.ts`** - Extended database layer:
   - Added `extends: ['../database']` to inherit database layer functionality
   - Enables cross-layer imports via aliases

## Documentation Overview

### CouchDB Design Document Structure

The lightning design document (`_design/lightning`) provides comprehensive views for querying lightning orders/invoices:

```typescript
export interface LightningOrder {
  _id: string;           // Document ID
  _rev?: string;         // CouchDB revision
  type: 'lightning_order'; // Document type identifier
  invoiceId: string;     // Lightning provider invoice ID
  paymentRequest?: string; // Lightning payment request
  amount: number;        // Amount in sats
  currency: string;      // Currency (usually 'sats')
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  provider: 'strike' | 'boltz';
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
  liquidAddress?: string; // For Boltz
  swapId?: string;       // For Boltz
}
```

### Available Views

1. **Basic Views:**
   - `by_invoice_id`: Query by lightning invoice ID
   - `by_status`: Query by payment status
   - `by_provider`: Query by lightning provider (strike/boltz)
   - `by_timestamp`: Query by creation date

2. **Compound Views:**
   - `by_status_and_timestamp`: Query by status and date
   - `by_provider_and_status`: Query by provider and status

3. **Specialized Views:**
   - `by_amount`: Query by payment amount
   - `by_expiration`: Query by expiration date
   - `by_swap_id`: Query Boltz swaps by swap ID

4. **Statistics Views:**
   - `stats_by_status`: Count orders by status
   - `stats_by_provider`: Sum amounts by provider

## Implementation Examples

### Server Plugin Usage

The initialization plugin automatically runs on server startup:

```typescript
// layers/lightning/server/plugins/init.ts
import { initializeDatabase, validateCouchDBEnvironment } from '#database/utils/couchdb';
import { lightningDesignDocument } from '../../utils/design-documents';

async function initializeLightningLayer(): Promise<void> {
  const runtimeConfig = useRuntimeConfig();
  const databaseName = `${runtimeConfig.dbLoginPrefix}-orders`;
  
  await initializeDatabase(databaseName, [lightningDesignDocument]);
}
```

### Cross-Layer Import Configuration

**Database Layer** (`layers/database/nuxt.config.ts`):
```typescript
import { fileURLToPath } from 'node:url'

export default defineNuxtConfig({
  alias: {
    '#database': fileURLToPath(new URL('.', import.meta.url))
  }
})
```

**Lightning Layer** (`layers/lightning/nuxt.config.ts`):
```typescript
export default defineNuxtConfig({
  extends: ['../database'],
  // ... other config
})
```

### Database Operations

Once initialized, you can perform CouchDB operations on the orders database:

```typescript
// Query pending orders
const pendingOrders = await queryView('bv-orders', 'lightning', 'by_status', {
  key: 'pending',
  include_docs: true
});

// Query orders by provider
const strikeOrders = await queryView('bv-orders', 'lightning', 'by_provider', {
  key: 'strike',
  include_docs: true
});

// Get statistics
const statusCounts = await queryView('bv-orders', 'lightning', 'stats_by_status', {
  group: true
});
```

### Database Naming Convention

The database name follows the pattern: `${runtimeConfig.dbLoginPrefix}-orders`

For example:
- App config: `dbLoginPrefix: 'bv-'`
- Database name: `bv--orders`
- Used for: Lightning payment orders and invoices

## Cross-Layer Import Best Practices

### Strategy 1: Layer Extension with Aliases (Recommended)

**Pros:**
- Clean import statements
- Type-safe imports
- Follows Nuxt patterns

**Implementation:**
1. Configure alias in base layer using `fileURLToPath`
2. Extend base layer in dependent layer
3. Use alias imports: `import { util } from '#database/utils/util'`

### Strategy 2: Relative Imports (Fallback)

**Pros:**
- Always works
- No configuration needed
- Explicit dependencies

**Cons:**
- Verbose import paths
- Brittle to directory structure changes

**Implementation:**
```typescript
import { util } from '../../../database/utils/util'
```

### Common Issues and Solutions

1. **"Could not resolve import" Error:**
   - Ensure base layer has proper alias configuration
   - Verify dependent layer extends base layer
   - Check `fileURLToPath` import is correct

2. **TypeScript Resolution:**
   - Configure `tsconfig.json` paths if needed
   - Ensure `moduleResolution: "Node"`

3. **Build vs Dev Differences:**
   - Test in both development and build modes
   - Aliases may behave differently in production

The lightning layer CouchDB integration successfully provides a robust, scalable database solution for managing lightning payment orders with comprehensive querying capabilities and proper cross-layer architecture.