# Cash-on-delivery orders and product catalog support

## Scope

- Extended the orders layer additively so existing `purchase` order listing remains compatible.
- Added `orders_product` documents in the orders database for simple product catalog storage.
- Added public product APIs, admin product APIs, and a simple cash-on-delivery checkout API.

## Changes

- Added catalog helpers in `server/utils/catalog.ts`:
  - product input normalization
  - public product mapping
  - cash-on-delivery purchase preparation
  - immediate stock decrement for submitted COD orders
- Added orders database helper utilities in `server/utils/orders-database.ts`.
- Added local admin-session assertion in `server/utils/auth.ts` so the layer keeps its existing database-only dependency surface.
- Expanded `_design/orders` with product and order views:
  - `products_by_sort_order`
  - `products_by_status`
  - `products_by_slug`
  - `orders_by_status`
  - `orders_by_payment_method`
- Added API routes:
  - `GET /api/store/products`
  - `GET /api/store/products/[slug]`
  - `POST /api/orders/cash-on-delivery`
  - `GET /api/orders/products`
  - `POST /api/orders/products`
  - `PUT /api/orders/products/[id]`
  - `DELETE /api/orders/products/[id]`
- Added admin workspace navigation for `/admin/orders/products`.
- Added `/admin/orders/products` product management page.

## Behavior Notes

- Product delete is implemented as archive/unpublish by setting `status: "archived"`.
- Product slug changes are blocked after creation to avoid orphaning the original document.
- The database name behavior intentionally preserves the existing `${dbLoginPrefix}-orders` convention, so `kids-store` continues using `ks--orders`.

## Verification

- `./node_modules/.bin/vitest --run orders/tests/catalog.spec.ts`
- `GET /api/store/products` returned 5 seeded active products on the kids-store dev server.
- Temporary COD order test returned `200` with `payment.method: "cash_on_delivery"`, then the temporary order was deleted and product seed stock was restored.
- Authenticated admin browser check confirmed `/admin/orders/products` renders and lists seeded products.
