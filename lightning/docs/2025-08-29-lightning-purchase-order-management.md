# Lightning Purchase Order Management

## Initial Prompt
When a purchase comes through the /api/lightning/purchase endpoint, first there needs to be created an order document with the request payload as content, alongside timestamp, type=purchase, id=purchase-[randomId] and the GET _session current doc "name" field based on the cookie headers passed with the request. The returned document id is then passed along to the createPayment function as the unique identifier in the meta data. Keep the order document processing logic in its own utility module.

## Implementation Summary
Successfully implemented order document creation before payment processing in the lightning purchase endpoint:

1. **Created Order Processing Utility Module** (`layers/lightning/utils/orders.ts`):
   - Added `OrderDocument` interface defining document structure
   - Implemented `generatePurchaseId()` for creating `purchase-[randomId]` format IDs  
   - Added `extractAuthSessionCookie()` to parse session cookies from headers
   - Created `getCurrentUserName()` to retrieve user name from CouchDB session
   - Implemented `createOrder()` function to create and save order documents

2. **Updated Purchase Endpoint** (`layers/lightning/server/api/lightning/purchase.post.ts`):
   - Added import for `createOrder` utility function
   - Modified flow to create order document before payment processing
   - Added database configuration logic using `dbLoginPrefix` from runtime config
   - Integrated order ID into payment metadata as unique identifier
   - Maintained existing error handling and validation

The implementation ensures that every purchase request creates a tracked order document linked to the payment via metadata, providing complete audit trail and traceability.

## Documentation Overview
This implementation adds order management capabilities to the lightning layer, ensuring all purchase requests are properly documented and tracked before payment creation.

### Key Components

#### Order Document Structure
```typescript
interface OrderDocument {
  _id: string;        // Same as id field
  id: string;         // Format: purchase-[randomId]  
  type: 'purchase';   // Fixed type identifier
  timestamp: string;  // ISO timestamp
  content: any;       // Full request payload
  userName: string;   // From session name field
}
```

#### Database Integration
- Orders are stored in database: `${dbLoginPrefix}-orders`
- Uses existing CouchDB utilities from database layer
- Integrates with existing database initialization in `server/plugins/init.ts`

### Implementation Examples

#### Creating an Order
```typescript
import { createOrder } from '../utils/orders'

const orderId = await createOrder({
  payload: requestBody,
  event: h3Event,
  databaseName: `${dbPrefix}-orders`
})
```

#### Order Document Example
```json
{
  "_id": "purchase-a1b2c3d4e5f6g7h8",
  "id": "purchase-a1b2c3d4e5f6g7h8", 
  "type": "purchase",
  "timestamp": "2024-08-29T10:30:45.123Z",
  "content": {
    "sats": 1000,
    "description": "Test purchase",
    "metadata": {...}
  },
  "userName": "john_doe"
}
```

#### Payment Metadata Integration
```typescript
const payment = await createPayment(sats, {
  description: 'Lightning purchase',
  metadata: {
    orderId: orderId, // Links payment to order
    timestamp: new Date().toISOString(),
    userAgent: event.node.req.headers['user-agent']
  }
})
```

### Usage Flow
1. Purchase request received at `/api/lightning/purchase`
2. Request validation and lightning config verification
3. **Order document creation** with user session data
4. Payment creation with order ID in metadata
5. Response returned with payment invoice

This ensures complete traceability between orders and payments while maintaining the existing API contract.