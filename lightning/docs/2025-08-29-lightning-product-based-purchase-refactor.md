# Lightning Product-Based Purchase Refactor

## Initial Prompt
Refactor the purchase.post.ts request to replace the "sats" request body value with a "product". The handler then loads the document called "products" from `${dbLoginPrefix}-orders` and looks for the sats value in the key [product]. For example, if a purchase comes for "pow_lab", the products doc must contain a numeric value called "pow_lab" and its contents are used for the "sats" parameter in the subsequent order and lightning invoice requests. If any of the document or fields are missing, the request is to fail with 400.

## Implementation Summary
Successfully refactored the lightning purchase endpoint to use product-based pricing instead of direct sats values:

1. **Updated Request Validation**:
   - Changed validation from `body.sats` (number) to `body.product` (string)
   - Added validation to ensure product is a non-empty string
   - Updated error messages to reflect product-based input

2. **Added Product Lookup Function** (`getProductPrice()`):
   - Loads "products" document from `${dbLoginPrefix}-orders` database
   - Validates product exists as a key in the document
   - Ensures product value is a positive number
   - Returns 400 errors for missing document, product, or invalid pricing

3. **Updated Purchase Flow**:
   - Product price lookup occurs before order creation
   - Resolved sats value is included in order document payload
   - Payment creation uses resolved sats value from products lookup
   - Maintains existing order ID tracking and metadata flow

4. **Error Handling**:
   - 400 error if "products" document doesn't exist
   - 400 error if product key doesn't exist in products document
   - 400 error if product value is not a positive number
   - Preserves existing error handling for authentication and payment failures

The refactoring transforms the API from accepting direct monetary values to product identifiers resolved through centralized pricing configuration.

## Documentation Overview
This refactoring enables product-based pricing for lightning purchases, centralizing price management in a single "products" document within the orders database.

### Key Changes

#### Request Format Change
**Before:**
```json
{
  "sats": 1000,
  "description": "Lightning purchase", 
  "metadata": {...}
}
```

**After:**
```json
{
  "product": "pow_lab",
  "description": "Lightning purchase",
  "metadata": {...}
}
```

#### Products Document Structure
The system now requires a "products" document in the orders database:
```json
{
  "_id": "products",
  "pow_lab": 1000,
  "premium_service": 5000,
  "basic_plan": 500,
  "enterprise": 10000
}
```

#### Product Lookup Function
```typescript
async function getProductPrice(product: string, databaseName: string): Promise<number> {
  // Load products document
  const productsDoc = await getDocument(databaseName, 'products')
  
  // Validate document exists
  if (!productsDoc) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Products document not found'
    })
  }
  
  // Validate product exists and is numeric
  if (!(product in productsDoc) || typeof productsDoc[product] !== 'number') {
    throw createError({
      statusCode: 400, 
      statusMessage: `Product "${product}" not found or invalid price`
    })
  }
  
  // Validate positive price
  const sats = productsDoc[product] as number
  if (sats <= 0) {
    throw createError({
      statusCode: 400,
      statusMessage: `Product "${product}" has invalid price: must be positive`
    })
  }
  
  return sats
}
```

### Implementation Examples

#### Product Purchase Request
```bash
curl -X POST /api/lightning/purchase \
  -H "Content-Type: application/json" \
  -H "Cookie: AuthSession=abc123..." \
  -d '{
    "product": "pow_lab",
    "description": "POW Lab Access",
    "metadata": {
      "userId": "user123"
    }
  }'
```

#### Order Document Result
```json
{
  "_id": "purchase-a1b2c3d4e5f6g7h8",
  "id": "purchase-a1b2c3d4e5f6g7h8",
  "type": "purchase", 
  "timestamp": "2024-08-29T10:30:45.123Z",
  "content": {
    "product": "pow_lab",
    "sats": 1000,
    "description": "POW Lab Access",
    "metadata": {
      "userId": "user123"
    }
  },
  "userName": "john_doe"
}
```

### Error Scenarios

1. **Missing Products Document**:
   ```json
   {
     "statusCode": 400,
     "statusMessage": "Products document not found"
   }
   ```

2. **Invalid Product**:
   ```json
   {
     "statusCode": 400,
     "statusMessage": "Product \"invalid_product\" not found or invalid price"
   }
   ```

3. **Invalid Product Value**:
   ```json
   {
     "statusCode": 400,
     "statusMessage": "Product \"pow_lab\" has invalid price: must be positive"
   }
   ```

### Usage Flow
1. Purchase request received with product identifier
2. Request validation ensures product is non-empty string
3. **Product price lookup** from products document
4. Order document creation with product and resolved sats
5. Payment creation using resolved sats value
6. Response returned with payment invoice

This refactoring enables centralized pricing management while maintaining backward compatibility in the response format and preserving all existing order tracking capabilities.