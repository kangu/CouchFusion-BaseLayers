# Strike Provider Sats to BTC Conversion

## Initial Prompt

Inside the Strike provider for the createInvoice function, request.amount is the value in sats, but the Strike API expects BTC (100 mil sats). Write a local helper function to convert from sats to BTC.

## Implementation Summary

Successfully added sats to BTC conversion functionality to the Strike provider to handle the currency mismatch between the internal system (which uses sats) and the Strike API (which expects BTC).

### Key Changes Made:

1. **Helper Function**: Created `satsToBtc()` function to convert satoshis to BTC with proper precision
2. **Currency Detection**: Added logic to detect when incoming currency is 'sats'
3. **Conversion Logic**: Updated `createInvoice` function to convert amounts appropriately
4. **Precision Handling**: Ensured 8 decimal place precision to maintain satoshi-level accuracy

### Files Modified:

- `/Users/radu/Projects/nuxt-apps/layers/lightning/providers/strike.ts`

## Documentation Overview

The Strike provider now properly handles amount conversion when receiving requests in satoshis, converting them to BTC format expected by the Strike API.

### Conversion Details

- **Conversion Rate**: 1 BTC = 100,000,000 satoshis
- **Precision**: 8 decimal places to maintain satoshi-level precision
- **Input Validation**: Prevents negative amounts
- **Currency Handling**: Automatically detects 'sats' currency and converts to 'BTC' for Strike API

## Implementation Examples

### 1. Sats to BTC Helper Function

```typescript
/**
 * Convert satoshis to BTC
 * @param sats - Amount in satoshis
 * @returns Amount in BTC as a string with proper precision
 */
function satsToBtc(sats: number): string {
    if (sats < 0) {
        throw new Error('Amount in sats cannot be negative')
    }
    // 1 BTC = 100,000,000 sats
    const btc = sats / 100_000_000
    // Return with 8 decimal places precision to handle satoshi-level precision
    return btc.toFixed(8)
}
```

### 2. Updated createInvoice Function Logic

```typescript
const createInvoice = async (request: InvoiceRequest): Promise<InvoiceResponse> => {
    console.log('Request inside strike', request)
    
    // Convert sats to BTC for Strike API if currency is sats
    let amount: string
    let currency: string
    
    if (request.currency.toLowerCase() === 'sats') {
        amount = satsToBtc(request.amount)
        currency = 'BTC'
    } else {
        amount = request.amount.toString()
        currency = request.currency.toUpperCase()
    }
    
    const payload = {
        correlationId: request.correlationId || crypto.randomUUID(),
        description: request.description || 'Lightning payment',
        amount: {
            amount,
            currency
        }
    }
    // ... rest of function
}
```

### Example Usage Scenarios

#### Scenario 1: Request in Sats
**Input Request:**
```json
{
    "amount": 880,
    "currency": "sats",
    "description": "Lightning purchase"
}
```

**Strike API Payload:**
```json
{
    "amount": {
        "amount": "0.00000880",
        "currency": "BTC"
    },
    "description": "Lightning purchase"
}
```

#### Scenario 2: Request in BTC (passthrough)
**Input Request:**
```json
{
    "amount": 0.001,
    "currency": "BTC",
    "description": "Lightning purchase"
}
```

**Strike API Payload:**
```json
{
    "amount": {
        "amount": "0.001",
        "currency": "BTC"
    },
    "description": "Lightning purchase"
}
```

### Conversion Examples

- **880 sats** → **0.00000880 BTC**
- **100,000,000 sats** → **1.00000000 BTC**  
- **50,000 sats** → **0.00050000 BTC**
- **1 sat** → **0.00000001 BTC**

The conversion maintains full precision to ensure no loss of value during the transformation from the internal sats representation to the Strike API's BTC requirement.