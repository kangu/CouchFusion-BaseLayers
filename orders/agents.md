# Layer: orders

`Runtime: nuxt 4.x, vue 3.5.x`

Orders / catalog layer: product management, purchase persistence, cash-on-delivery ordering, and admin label settings. Backed by a per-app CouchDB database (`<dbLoginPrefix>-orders`). Consumed by `apps/bitvocation`, `apps/forest-cabin`, `apps/kangu`, `apps/kids-store`, `apps/nuxt-app-starter`, `apps/tulin-delivery`.

## Folder map
- `app/pages/admin/orders/products.vue` — admin product management page (`admin-workspace` layout, `auth`+`role-auth` middleware, role `admin`).
- `server/plugins/init.ts` — DB init: validates env, resolves db name from `dbLoginPrefix`, installs `ordersDesignDocument`.
- `server/api/orders/` — admin endpoints:
  - `GET /api/orders` (list purchases)
  - `POST /api/orders/cash-on-delivery` (public checkout)
  - `GET/POST /api/orders/products`, `PUT/DELETE /api/orders/products/:id`
  - `GET/PUT /api/orders/settings/admin-labels`
- `server/api/store/products/` — public storefront: `GET /api/store/products`, `GET /api/store/products/:slug`.
- `server/utils/` — `orders-database.ts` (db name resolution + queries), `catalog.ts` (product doc types + `buildCashOnDeliveryPurchase`), `auth.ts`, `admin-labels.ts`.
- `utils/design-documents.ts` — CouchDB design doc (`_design/orders`) with views: `by_timestamp`, `products_by_sort_order`, `products_by_status`.
- `tests/` — `admin-labels.spec.ts`, `catalog.spec.ts`.
- `docs/` — `README.md` + `implementation_results/` (cash-on-delivery, admin labels, state analysis).

## Public API / Exports
- Alias: none declared in `nuxt.config.ts`. Import via relative `#database`-style paths or explicit relative imports.
- App config contribution: `appConfig.adminWorkspace.sections` (id `orders`) and `appConfig.uiNavigation.sections` (id `orders`) — registers Products admin entry (route `/admin/orders/products`, role `admin`).
- HTTP endpoints listed in Folder map above.
- Server utils (explicit relative imports):
  - `resolveOrdersDatabaseName(dbLoginPrefix)`, `getOrdersDatabaseName()`, `listProductDocuments(status?)` (`server/utils/orders-database.ts`)
  - `buildCashOnDeliveryPurchase(...)`, `OrdersProductDocument` type (`server/utils/catalog.ts`)
  - admin-label getters/setters (`server/utils/admin-labels.ts`)

## Conventions
- DB name pattern: `${dbLoginPrefix}-orders` — never hardcode; use `resolveOrdersDatabaseName`.
- Doc types: `purchase` (orders) and `orders_product` (catalog items). Both emitted by views in `utils/design-documents.ts`.
- Product status values: `'draft' | 'published'` (see `products_by_status` view).
- `dbLoginPrefix` is read from `runtimeConfig.dbLoginPrefix` (set by consuming app).
- Public store endpoints (`/api/store/**`) must NOT require auth; admin endpoints (`/api/orders/**` except cash-on-delivery) require `admin` role via `server/utils/auth.ts`.
- App config sections are duplicated across `adminWorkspace` and `uiNavigation` — keep in sync.

## Dependencies
- Peer: no `package.json` present — inherits from consuming app (Nuxt 4).
- Extends layer: `../database` (declared in `nuxt.config.ts`). Uses `#database/utils/couchdb` (`initializeDatabase`, `validateCouchDBEnvironment`, `getView`, `bulkDocs`).
- Runtime deps expected from consuming app: `h3` (via Nuxt/Nitro), `node:crypto`.
- Consuming app must provide `runtimeConfig.dbLoginPrefix` and an `auth`/`role-auth` middleware + `admin-workspace` layout.

## Build / Test commands
No `package.json` and no standalone lint/typecheck script. Colocated specs:

```bash
# from repo root
npx vitest run layers/orders
```

Typecheck/lint inside a consuming app:

```bash
cd apps/bitvocation && nuxt typecheck   # or any other consumer
```

## Gotchas / Pitfalls
- No `package.json` exists in this layer — version/peer info is implicit. Add one if standalone tooling is needed.
- Cash-on-delivery endpoint writes a `purchase` doc via `bulkDocs` and assumes product docs exist; missing products are silently skipped (check `listProductDocuments` filtering).
- `getOrdersDatabaseName()` calls `useRuntimeConfig()` — must run inside Nitro request context, not at module load.
- Admin-label settings are stored in CouchDB; if the design doc is not installed, the products admin page shows empty.
- Public `/api/store/products/:slug` does no role check — ensure no sensitive fields leak into the product doc shape.

## Cross-references
- Root: `/Users/radu/Projects/nuxt-apps/AGENTS.md`
- Layer docs: `docs/README.md`, `docs/implementation_results/`.
- Related layers: `layers/database`, `layers/admin_workspace`, `layers/ui_navigation`, `layers/auth`.
- Related skills: none specific.
