# Admin label settings document

## Scope

- Added an editable settings document for orders product-admin operational labels.

## Changes

- Added `server/utils/admin-labels.ts` with:
  - default label values
  - document id `settings:orders-admin-labels`
  - document type `orders_admin_labels`
  - normalization helper for partial settings payloads
- Added protected API routes:
  - `GET /api/orders/settings/admin-labels`
  - `PUT /api/orders/settings/admin-labels`
- Updated `/admin/orders/products` to use settings-backed labels for page chrome, table headings, form labels, buttons, and notices.

## Verification

- `./node_modules/.bin/vitest --run orders/tests/catalog.spec.ts orders/tests/admin-labels.spec.ts`
  - 2 files passed.
  - 4 tests passed.

## Runtime Data

- Upserted the default admin labels document into the kids-store orders database:
  - database: `ks--orders`
  - document id: `settings:orders-admin-labels`
