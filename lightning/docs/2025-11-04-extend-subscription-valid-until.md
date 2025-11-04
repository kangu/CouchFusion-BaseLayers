# Initial Prompt
Implement the specs in docs/specs/extend_subscription.md.

# Implementation Summary
Returned full product documents from `getProductPrice` and computed subscription `validUntil` in the lightning purchase handler using existing user sessions before persisting the order.

# Documentation Overview
- `layers/lightning/utils/orders.ts` now returns the entire product record (memo, sats, valid_days, etc.) enabling downstream consumers to use new fields without extra CouchDB queries.
- `layers/lightning/server/api/lightning/purchase.post.ts` reads the expanded product info, checks the caller's CouchDB session for existing validity windows, and calculates a fresh ISO `validUntil` timestamp when `valid_days` is provided.
- Orders now store the calculated `validUntil` alongside the payload so automation layers can immediately react to subscription expirations.

# Implementation Examples
- `layers/lightning/utils/orders.ts`
  ```ts
  if (!productData || typeof productData !== 'object') {
      throw new Error(`Product "${product}" has invalid structure: expected object with memo and sats`)
  }

  const { memo, sats } = productData as {
      memo?: unknown;
      sats?: unknown;
  }
  ```

- `layers/lightning/server/api/lightning/purchase.post.ts`
  ```ts
  if (typeof valid_days === 'number' && Number.isFinite(valid_days) && valid_days > 0) {
      const startingDate = await resolveStartingDate(event, body.product)
      const expirationDate = new Date(startingDate.getTime())
      expirationDate.setUTCDate(expirationDate.getUTCDate() + Math.floor(valid_days))
      validUntil = expirationDate.toISOString()
  }
  ```
