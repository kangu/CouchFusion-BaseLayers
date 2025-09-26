# Product Structure Refactor with Memo Templating

## Initial Prompt

Refactor the getProductPrice function to account for the change in the "products" document structure. Before, we had "pow_lab": 880, now we have "pow_lab": {"memo": "welcome {{telegram}}", "sats": 880}. Return the entire object and use it in the purchase.post handler to create the memo/description for the createPayment call by running the memo field through a replace for {{ }} value matched against the payload. In this case, {{telegram}} will be replaced because it's coming in the request payload.

## Implementation Summary

Successfully refactored the `getProductPrice` function and related components to support the new product document structure with memo templating:

### Key Changes Made:

1. **Type Definitions**: Added `ProductInfo` interface to define the new product structure
2. **Updated getProductPrice Function**: Modified to return `{memo: string, sats: number}` instead of just the sats number
3. **Template Replacement Utility**: Created `replaceMemoTemplate` function to process `{{key}}` placeholders
4. **Purchase Handler Integration**: Updated purchase.post.ts to use the new structure and process memo templates

### Files Modified:

- `/Users/radu/Projects/nuxt-apps/layers/lightning/utils/orders.ts`
- `/Users/radu/Projects/nuxt-apps/layers/lightning/server/api/lightning/purchase.post.ts`

## Documentation Overview

The refactored system now supports dynamic memo generation for Lightning payments based on product configuration and request payload data.

### New Product Document Structure

Products in the database now follow this structure:
```json
{
  "pow_lab": {
    "memo": "welcome {{telegram}}",
    "sats": 880
  }
}
```

### Template Replacement

The memo field supports template placeholders using double curly braces `{{key}}`. These are replaced with corresponding values from the request payload:

- `{{telegram}}` → replaced with `body.telegram` value
- `{{username}}` → replaced with `body.username` value
- etc.

If a placeholder key doesn't exist in the payload, the placeholder is left unchanged.

## Implementation Examples

### 1. ProductInfo Interface

```typescript
export interface ProductInfo {
    memo: string;
    sats: number;
}
```

### 2. Updated getProductPrice Function

```typescript
export async function getProductPrice(product: string, databaseName: string): Promise<ProductInfo> {
    const productsDoc = await getDocument(databaseName, 'products')
    
    if (!productsDoc) {
        throw new Error('Products document not found')
    }

    if (!(product in productsDoc)) {
        throw new Error(`Product "${product}" not found`)
    }

    const productData = productsDoc[product]

    if (!productData || typeof productData !== 'object' || 
        typeof productData.memo !== 'string' || 
        typeof productData.sats !== 'number') {
        throw new Error(`Product "${product}" has invalid structure: expected {memo: string, sats: number}`)
    }

    const { memo, sats } = productData

    if (sats <= 0) {
        throw new Error(`Product "${product}" has invalid price: must be positive`)
    }

    return { memo, sats }
}
```

### 3. Template Replacement Utility

```typescript
export function replaceMemoTemplate(memo: string, payload: Record<string, any>): string {
    return memo.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return payload[key] !== undefined ? String(payload[key]) : match
    })
}
```

### 4. Usage in Purchase Handler

```typescript
// Get product info from products document
const productInfo = await getProductPrice(body.product, ordersDatabase)
const { memo, sats } = productInfo

// Process memo template with payload values
const processedMemo = replaceMemoTemplate(memo, body)

// Create payment with processed memo as description
const payment = await createPayment(sats, {
    description: processedMemo,
    provider: lightningConfig.defaultProvider,
    metadata: {
        orderId: orderId,
        timestamp: new Date().toISOString(),
        userAgent: event.node.req.headers['user-agent']
    }
})
```

### Example Usage Scenario

**Request payload:**
```json
{
    "product": "pow_lab",
    "telegram": "@johndoe",
    "metadata": {}
}
```

**Product configuration:**
```json
{
    "pow_lab": {
        "memo": "welcome {{telegram}}",
        "sats": 880
    }
}
```

**Result:**
- Lightning invoice created for 880 sats
- Invoice description: "welcome @johndoe"
- Template `{{telegram}}` successfully replaced with `@johndoe`